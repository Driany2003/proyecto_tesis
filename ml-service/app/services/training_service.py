import logging
from pathlib import Path

import joblib
import numpy as np
import psycopg2
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import roc_auc_score, recall_score, precision_score, f1_score, confusion_matrix
from sklearn.model_selection import cross_val_predict, StratifiedKFold
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier

from app.config import settings

logger = logging.getLogger("ml-service.training")

FEATURE_COLS = ["f0_mean", "jitter", "shimmer", "hnr", "nhr"]
RETRAIN_THRESHOLD = 10

_retrain_counter = 0


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


def load_training_data() -> tuple[np.ndarray, np.ndarray, list[str]]:
    conn = psycopg2.connect(**get_db_config())
    try:
        df = pd.read_sql("SELECT * FROM training_samples", conn)
    finally:
        conn.close()

    available = [c for c in FEATURE_COLS if c in df.columns and df[c].notna().sum() > 0]
    X = df[available].fillna(0).values
    y = df["label"].astype(int).values

    logger.info("Datos cargados: %d muestras, %d features", len(X), len(available))
    return X, y, available


def train_model(X: np.ndarray, y: np.ndarray, feature_names: list[str]) -> dict:
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    class_counts = np.bincount(y)
    min_count = int(class_counts.min()) if class_counts.size > 0 else 0
    if min_count < 2:
        raise ValueError(
            "Cada clase necesita al menos 2 muestras para validación cruzada estratificada;"
            f" distribución actual: {dict(enumerate(class_counts.tolist()))}"
        )
    n_splits = max(2, min(5, min_count))
    cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)

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
            y_proba = cross_val_predict(model, X_scaled, y, cv=cv, method="predict_proba")[:, 1]
            auc_val = roc_auc_score(y, y_proba)
            logger.info("%s AUC=%.4f", name, auc_val)
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
    X, y, features = load_training_data()

    if len(X) < 10:
        raise ValueError(f"Insuficientes muestras ({len(X)}). Mínimo: 10.")

    result = train_model(X, y, features)
    save_and_reload(result["bundle"])

    global _retrain_counter
    _retrain_counter = 0

    logger.info("Re-entrenamiento completado: %s", result["metrics"])
    return result["metrics"]


def increment_sample_counter() -> bool:
    global _retrain_counter
    _retrain_counter += 1
    return _retrain_counter >= RETRAIN_THRESHOLD
