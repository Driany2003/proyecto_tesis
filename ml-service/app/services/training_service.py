import logging
import threading
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import psycopg2
import psycopg2.pool
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import roc_auc_score, recall_score, precision_score, f1_score, confusion_matrix
from sklearn.model_selection import cross_val_predict, GroupKFold, StratifiedKFold
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier

from app.config import settings
from app.services.feature_constants import ACOUSTIC_FEATURES

logger = logging.getLogger("ml-service.training")

FEATURE_COLS = ACOUSTIC_FEATURES
RETRAIN_THRESHOLD = 10

_retrain_counter = 0
_retrain_lock = threading.Lock()
_db_pool: Optional[psycopg2.pool.SimpleConnectionPool] = None


def _get_connection():
    global _db_pool
    if _db_pool is None:
        cfg = get_db_config()
        _db_pool = psycopg2.pool.SimpleConnectionPool(1, 5, **cfg)
    return _db_pool.getconn()


def _return_connection(conn):
    global _db_pool
    if _db_pool is not None:
        _db_pool.putconn(conn)


def get_db_config() -> dict:
    missing = [
        name
        for name, value in (
            ("ML_DB_HOST", settings.db_host),
            ("ML_DB_NAME", settings.db_name),
            ("ML_DB_USER", settings.db_user),
            ("ML_DB_PASSWORD", settings.db_password),
        )
        if not value
    ]
    if missing:
        raise RuntimeError(
            "Faltan variables de entorno para conectar a PostgreSQL: " + ", ".join(missing)
        )
    return {
        "host": settings.db_host,
        "port": settings.db_port,
        "dbname": settings.db_name,
        "user": settings.db_user,
        "password": settings.db_password,
    }


def load_training_data() -> tuple[np.ndarray, np.ndarray, np.ndarray, list[str]]:
    conn = _get_connection()
    try:
        df = pd.read_sql("SELECT * FROM training_samples", conn)
    finally:
        _return_connection(conn)

    available = [c for c in FEATURE_COLS if c in df.columns and df[c].notna().sum() > 0]
    X = df[available].fillna(0).values
    y = df["label"].astype(int).values

    if "subject_id" in df.columns and df["subject_id"].notna().any():
        groups = df["subject_id"].fillna(df["patient_ref"] if "patient_ref" in df.columns else None).fillna(df["source"]).values
    elif "patient_ref" in df.columns:
        groups = df["patient_ref"].fillna(df["source"]).values
    else:
        groups = df.index.astype(str).values

    logger.info("Datos cargados: %d muestras, %d features, %d sujetos", len(X), len(available), len(np.unique(groups)))
    return X, y, groups, available


def train_model(X: np.ndarray, y: np.ndarray, groups: np.ndarray, feature_names: list[str]) -> dict:
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    class_counts = np.bincount(y)
    min_count = int(class_counts.min()) if class_counts.size > 0 else 0
    if min_count < 2:
        raise ValueError(
            "Cada clase necesita al menos 2 muestras para validación cruzada;"
            f" distribución actual: {dict(enumerate(class_counts.tolist()))}"
        )
    n_unique_groups = len(np.unique(groups))
    n_splits = max(2, min(5, n_unique_groups, min_count))
    cv = GroupKFold(n_splits=n_splits)

    rf = RandomForestClassifier(n_estimators=200, max_depth=10, random_state=42, class_weight="balanced")
    xgb = XGBClassifier(
        n_estimators=200, max_depth=6, learning_rate=0.1, random_state=42,
        eval_metric="logloss", use_label_encoder=False,
        scale_pos_weight=(y == 0).sum() / max((y == 1).sum(), 1),
    )

    best_model = None
    best_auc = 0
    best_name = ""

    for name, model in [("RandomForest", rf), ("XGBoost", xgb)]:
        try:
            y_proba = cross_val_predict(model, X_scaled, y, cv=cv, groups=groups, method="predict_proba")[:, 1]
            auc_val = roc_auc_score(y, y_proba)
            logger.info("%s AUC=%.4f (GroupKFold, n_splits=%d)", name, auc_val, n_splits)
            if auc_val > best_auc:
                best_auc = auc_val
                best_name = name
                best_model = model
        except Exception as e:
            logger.warning("Error entrenando %s: %s", name, e)

    if best_model is None:
        raise RuntimeError("No se pudo entrenar ningún modelo")

    best_model.fit(X_scaled, y)
    calibrated = CalibratedClassifierCV(best_model, cv=3, method="isotonic")
    calibrated.fit(X_scaled, y)

    y_pred = calibrated.predict(X_scaled)
    y_proba_final = calibrated.predict_proba(X_scaled)[:, 1]

    cm = confusion_matrix(y, y_pred, labels=[0, 1])
    if cm.shape != (2, 2):
        logger.warning("confusion_matrix con forma inesperada %s; rellenando con ceros", cm.shape)
        padded = np.zeros((2, 2), dtype=int)
        rows = min(cm.shape[0], 2)
        cols = min(cm.shape[1], 2)
        padded[:rows, :cols] = cm[:rows, :cols]
        cm = padded
    tn, fp, fn, tp = cm.ravel()
    metrics = {
        "model_name": best_name,
        "samples": int(len(y)),
        "auc_roc": round(float(roc_auc_score(y, y_proba_final)), 4),
        "sensitivity": round(float(tp / (tp + fn)) if (tp + fn) > 0 else 0, 4),
        "specificity": round(float(tn / (tn + fp)) if (tn + fp) > 0 else 0, 4),
        "precision": round(float(precision_score(y, y_pred, zero_division=0)), 4),
        "f1_score": round(float(f1_score(y, y_pred, zero_division=0)), 4),
    }

    bundle = {
        "model": calibrated,
        "raw_model": best_model,
        "scaler": scaler,
        "features": feature_names,
        "model_name": best_name,
    }

    return {"bundle": bundle, "metrics": metrics}


def save_and_reload(bundle: dict) -> None:
    model_path = Path(settings.model_path)
    model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, str(model_path))
    logger.info("Modelo guardado en %s", model_path)

    from app.services.model_service import load_model
    load_model()
    logger.info("Modelo recargado en memoria")


async def retrain() -> dict:
    logger.info("Iniciando re-entrenamiento...")
    X, y, groups, features = load_training_data()

    if len(X) < 10:
        raise ValueError(f"Insuficientes muestras ({len(X)}). Mínimo: 10.")

    result = train_model(X, y, groups, features)
    save_and_reload(result["bundle"])

    global _retrain_counter
    with _retrain_lock:
        _retrain_counter = 0

    logger.info("Re-entrenamiento completado: %s", result["metrics"])
    return result["metrics"]


def increment_sample_counter() -> bool:
    global _retrain_counter
    with _retrain_lock:
        _retrain_counter += 1
        return _retrain_counter >= RETRAIN_THRESHOLD
