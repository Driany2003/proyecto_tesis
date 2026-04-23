"""
OE02: Entrenamiento del modelo probabilístico de detección de Parkinson.

- Carga datos de training_samples (UCI + propios)
- Entrena RandomForest y XGBoost (comparación)
- Evalúa: sensibilidad, especificidad, precisión, F1, AUC, calibración
- Calcula intervalos de confianza con bootstrap
- Guarda el mejor modelo como .joblib
- Exporta métricas como JSON

Uso:
    python train_model.py
"""

import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import psycopg2
from sklearn.calibration import CalibratedClassifierCV, calibration_curve
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    auc,
    brier_score_loss,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier

sys.path.insert(0, str(Path(__file__).parent))
from config import DB_CONFIG, EVIDENCE_DIR, MODEL_OUTPUT_PATH

FEATURE_COLS = ["f0_mean", "jitter", "shimmer", "hnr", "nhr"]


def load_training_data() -> tuple[pd.DataFrame, np.ndarray, np.ndarray]:
    """Carga datos de PostgreSQL y devuelve DataFrame, X, y."""
    conn = psycopg2.connect(**DB_CONFIG)
    df = pd.read_sql(
        "SELECT * FROM training_samples ORDER BY created_at", conn
    )
    conn.close()

    print(f"Total muestras: {len(df)}")
    print(f"  Parkinson (label=True):  {(df['label'] == True).sum()}")
    print(f"  Sano (label=False):      {(df['label'] == False).sum()}")
    print(f"  Fuentes: {df['source'].value_counts().to_dict()}")

    available = [c for c in FEATURE_COLS if c in df.columns and df[c].notna().sum() > 0]
    print(f"  Features disponibles: {available}")

    X = df[available].fillna(0).values
    y = df["label"].astype(int).values

    return df, X, y, available


def bootstrap_ci(y_true, y_proba, metric_fn, n_boot=1000, ci=0.95):
    """Calcula intervalo de confianza por bootstrap."""
    rng = np.random.RandomState(42)
    scores = []
    n = len(y_true)
    for _ in range(n_boot):
        idx = rng.randint(0, n, size=n)
        try:
            s = metric_fn(y_true[idx], y_proba[idx])
            scores.append(s)
        except ValueError:
            continue
    scores = np.array(scores)
    alpha = (1 - ci) / 2
    return float(np.percentile(scores, 100 * alpha)), float(np.percentile(scores, 100 * (1 - alpha)))


def evaluate_model(name: str, y_true: np.ndarray, y_proba: np.ndarray, y_pred: np.ndarray) -> dict:
    """Evalúa un modelo y devuelve todas las métricas."""
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred).ravel()

    sensitivity = tp / (tp + fn) if (tp + fn) > 0 else 0
    specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
    precision = precision_score(y_true, y_pred, zero_division=0)
    f1 = f1_score(y_true, y_pred, zero_division=0)
    acc = accuracy_score(y_true, y_pred)
    auc_score = roc_auc_score(y_true, y_proba)
    brier = brier_score_loss(y_true, y_proba)

    auc_ci = bootstrap_ci(y_true, y_proba, roc_auc_score)
    sens_ci = bootstrap_ci(y_true, y_pred, recall_score)
    spec_ci_fn = lambda yt, yp: confusion_matrix(yt, yp).ravel()[0] / (confusion_matrix(yt, yp).ravel()[0] + confusion_matrix(yt, yp).ravel()[1]) if (confusion_matrix(yt, yp).ravel()[0] + confusion_matrix(yt, yp).ravel()[1]) > 0 else 0
    spec_ci = bootstrap_ci(y_true, y_pred, spec_ci_fn)

    metrics = {
        "model": name,
        "accuracy": round(acc, 4),
        "sensitivity_recall": round(sensitivity, 4),
        "sensitivity_ci95": [round(sens_ci[0], 4), round(sens_ci[1], 4)],
        "specificity": round(specificity, 4),
        "specificity_ci95": [round(spec_ci[0], 4), round(spec_ci[1], 4)],
        "precision": round(precision, 4),
        "f1_score": round(f1, 4),
        "auc_roc": round(auc_score, 4),
        "auc_ci95": [round(auc_ci[0], 4), round(auc_ci[1], 4)],
        "brier_score": round(brier, 4),
        "confusion_matrix": {"TP": int(tp), "TN": int(tn), "FP": int(fp), "FN": int(fn)},
    }

    print(f"\n{'='*50}")
    print(f"  Modelo: {name}")
    print(f"{'='*50}")
    print(f"  Accuracy:    {acc:.4f}")
    print(f"  Sensibilidad:{sensitivity:.4f}  IC95%: [{sens_ci[0]:.4f}, {sens_ci[1]:.4f}]")
    print(f"  Especificidad:{specificity:.4f} IC95%: [{spec_ci[0]:.4f}, {spec_ci[1]:.4f}]")
    print(f"  Precisión:   {precision:.4f}")
    print(f"  F1 Score:    {f1:.4f}")
    print(f"  AUC-ROC:     {auc_score:.4f}  IC95%: [{auc_ci[0]:.4f}, {auc_ci[1]:.4f}]")
    print(f"  Brier Score: {brier:.4f}")
    print(f"  Matriz: TP={tp} TN={tn} FP={fp} FN={fn}")

    return metrics


def train_and_compare(X: np.ndarray, y: np.ndarray, feature_names: list[str]) -> dict:
    """Entrena RF y XGBoost con CV, evalúa, y devuelve el mejor."""

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

    models = {
        "RandomForest": RandomForestClassifier(
            n_estimators=200, max_depth=10, random_state=42, class_weight="balanced"
        ),
        "XGBoost": XGBClassifier(
            n_estimators=200, max_depth=6, learning_rate=0.1,
            random_state=42, eval_metric="logloss", use_label_encoder=False,
            scale_pos_weight=(y == 0).sum() / max((y == 1).sum(), 1),
        ),
    }

    all_metrics = {}
    best_model = None
    best_auc = 0
    best_name = ""

    for name, model in models.items():
        print(f"\nEntrenando {name} con 5-fold CV...")

        y_proba = cross_val_predict(model, X_scaled, y, cv=cv, method="predict_proba")[:, 1]
        y_pred = (y_proba >= 0.5).astype(int)

        metrics = evaluate_model(name, y, y_proba, y_pred)
        all_metrics[name] = metrics

        fpr, tpr, _ = roc_curve(y, y_proba)
        metrics["roc_curve"] = {"fpr": fpr.tolist(), "tpr": tpr.tolist()}

        try:
            prob_true, prob_pred = calibration_curve(y, y_proba, n_bins=8, strategy="uniform")
            metrics["calibration"] = {
                "prob_true": prob_true.tolist(),
                "prob_pred": prob_pred.tolist(),
            }
        except ValueError:
            metrics["calibration"] = {"prob_true": [], "prob_pred": []}

        if metrics["auc_roc"] > best_auc:
            best_auc = metrics["auc_roc"]
            best_name = name
            best_model = model

    print(f"\n>>> Mejor modelo: {best_name} (AUC={best_auc:.4f})")

    print(f"\nEntrenando modelo final ({best_name}) con TODOS los datos...")
    best_model.fit(X_scaled, y)

    calibrated = CalibratedClassifierCV(best_model, cv=3, method="isotonic")
    calibrated.fit(X_scaled, y)

    if hasattr(best_model, "feature_importances_"):
        importances = best_model.feature_importances_
        fi = sorted(zip(feature_names, importances), key=lambda x: x[1], reverse=True)
        print("\nFeature Importance:")
        for feat, imp in fi:
            bar = "█" * int(imp * 50)
            print(f"  {feat:20s} {imp:.4f} {bar}")
        all_metrics["feature_importance"] = [
            {"feature": f, "importance": round(float(i), 4)} for f, i in fi
        ]

    return {
        "best_model_name": best_name,
        "model": calibrated,
        "raw_model": best_model,
        "scaler": scaler,
        "features": feature_names,
        "metrics": all_metrics,
    }


def save_model(result: dict):
    """Guarda modelo + scaler + metadata como .joblib."""
    output_path = Path(__file__).parent / MODEL_OUTPUT_PATH
    output_path.parent.mkdir(parents=True, exist_ok=True)

    bundle = {
        "model": result["model"],
        "raw_model": result["raw_model"],
        "scaler": result["scaler"],
        "features": result["features"],
        "model_name": result["best_model_name"],
    }
    joblib.dump(bundle, str(output_path))
    print(f"\nModelo guardado en: {output_path.resolve()}")

    metrics_path = Path(__file__).parent / EVIDENCE_DIR / "metrics.json"
    metrics_path.parent.mkdir(parents=True, exist_ok=True)

    metrics_clean = {}
    for k, v in result["metrics"].items():
        if isinstance(v, dict):
            clean = {mk: mv for mk, mv in v.items() if mk not in ("roc_curve", "calibration")}
            metrics_clean[k] = clean
        else:
            metrics_clean[k] = v

    with open(metrics_path, "w") as f:
        json.dump(result["metrics"], f, indent=2, ensure_ascii=False)
    print(f"Métricas guardadas en: {metrics_path.resolve()}")


if __name__ == "__main__":
    print("=" * 60)
    print("  ENTRENAMIENTO — Modelo de Detección de Parkinson")
    print("=" * 60)

    df, X, y, feature_names = load_training_data()

    if len(X) < 10:
        print("\nError: Se necesitan al menos 10 muestras para entrenar.")
        print("Ejecuta primero: python download_uci_dataset.py")
        sys.exit(1)

    result = train_and_compare(X, y, feature_names)
    save_model(result)

    print("\n" + "=" * 60)
    print("  ENTRENAMIENTO COMPLETADO")
    print("=" * 60)
