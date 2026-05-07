"""Entrenamiento v2 — Detección de Parkinson sobre habla conectada.

Mejoras críticas vs `train_model.py` (v1):

  1) Validación cruzada por SUJETO (`GroupKFold`), no por grabación.
     Hoy en v1 se usa `StratifiedKFold`, lo que infla el AUC porque dos
     grabaciones del MISMO paciente pueden caer una en train y otra en test
     (data leakage por sujeto). Con GroupKFold un paciente está enteramente
     en un fold → métricas honestas.

  2) Filtra por `task_type` para evitar el TASK MISMATCH:
     - Por defecto entrena solo con tareas de habla conectada
       (reading + monologue + listen_repeat), que es lo que graba el
       sistema en producción.
     - `--include-vowels` permite mezclarlo con vocales sostenidas si
       quieres comparar.

  3) Usa hasta 12 features (5 acústicas + 7 NLP) cuando están disponibles.
     v1 solo usaba 5 acústicas y descartaba toda la rama lingüística.

  4) Reporta métricas operativas (Youden, Sens@90%, Spec@95%) sobre la
     curva ROC para que la pantalla de "umbrales de riesgo" tenga
     valores DERIVADOS DEL MODELO, no inventados.

Uso:
    # Solo habla conectada (recomendado, alineado con producción):
    python scripts/train_v2.py

    # Mezclando vocales sostenidas (si tienes pocos datos conectados):
    python scripts/train_v2.py --include-vowels

    # Solo features acústicas (ablación):
    python scripts/train_v2.py --no-nlp
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import psycopg2
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import GroupKFold, cross_val_predict
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier

sys.path.insert(0, str(Path(__file__).parent))
from config import DB_CONFIG, EVIDENCE_DIR, MODEL_OUTPUT_PATH

ACOUSTIC_FEATURES = [
    "f0_mean",
    "f0_std",
    "f0_min",
    "f0_max",
    "jitter",
    "shimmer",
    "hnr",
    "nhr",
]

# Camino A: features extendidas (extended_features_service)
EXTENDED_SCALAR_FEATURES = [
    "cpp_mean",
    "dfa",
    "sample_entropy",
    "ppe",
    "rpde",
    "intensity_mean",
    "intensity_std",
]

# MFCC: 13 coeficientes -> media + std => 26 columnas dinámicas
EXTENDED_MFCC_VECTOR_COLS = ["mfcc_means", "mfcc_stds"]
N_MFCC = 13

NLP_FEATURES = ["ttr", "words_per_min", "avg_word_length",
                "pause_ratio", "filler_count", "sentence_count", "duration_sec"]

CONNECTED_SPEECH_TASKS = ("reading", "monologue", "listen_repeat")


def _expand_mfcc_columns(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    """Convierte mfcc_means / mfcc_stds (jsonb -> list) en columnas planas.

    Si la columna no existe o es totalmente NULL, no añade nada.
    """
    new_cols: list[str] = []
    for vec_col in EXTENDED_MFCC_VECTOR_COLS:
        if vec_col not in df.columns or df[vec_col].notna().sum() == 0:
            continue
        # psycopg2 + jsonb suele devolver list[float] directo; defensivo por si vuelve str
        def _to_list(v):
            if isinstance(v, list):
                return v
            if isinstance(v, str):
                try:
                    return json.loads(v)
                except Exception:  # noqa: BLE001
                    return None
            return None

        parsed = df[vec_col].apply(_to_list)
        for k in range(N_MFCC):
            col_name = f"{vec_col}_{k}"
            df[col_name] = parsed.apply(
                lambda xs, kk=k: float(xs[kk]) if (xs is not None and len(xs) > kk) else np.nan
            )
            new_cols.append(col_name)
    return df, new_cols


# ---------------------------------------------------------------------------
# Carga de datos
# ---------------------------------------------------------------------------


def load_training_data(include_vowels: bool, use_nlp: bool, use_mfcc: bool = True, exclude_young_hc: bool = False) -> tuple[pd.DataFrame, np.ndarray, np.ndarray, np.ndarray, list[str]]:
    """Devuelve (df, X, y, groups, feature_names).

    `groups` se usa con GroupKFold y representa el paciente: dos filas con el
    mismo `groups[i]` JAMÁS quedan en folds distintos.
    """
    conn = psycopg2.connect(**DB_CONFIG)
    try:
        df = pd.read_sql(
            "SELECT * FROM training_samples",
            conn,
        )
    finally:
        conn.close()

    if df.empty:
        raise SystemExit("training_samples está vacío. Corre primero los scripts/datasets/*.")

    # Filtro de tipo de tarea
    if "task_type" not in df.columns:
        raise SystemExit(
            "Falta columna `task_type`. Aplica scripts/migrations/001_extend_training_samples.sql"
        )
    if not include_vowels:
        before = len(df)
        df = df[df["task_type"].isin(CONNECTED_SPEECH_TASKS)].copy()
        print(f"Filtrando a habla conectada: {before} -> {len(df)} filas")

    if exclude_young_hc and "subject_id" in df.columns:
        before = len(df)
        df = df[~df["subject_id"].str.startswith("HC_young", na=False)].copy()
        print(f"Excluyendo HC_young (control sesgo edad): {before} -> {len(df)} filas")

    if df.empty:
        raise SystemExit(
            "Sin filas tras filtrar por habla conectada. "
            "Corre `scripts/datasets/neurovoz.py ingest` o usa `--include-vowels`."
        )

    # Expandir MFCC (jsonb) a columnas planas mfcc_means_0..12 / mfcc_stds_0..12
    if use_mfcc:
        df, mfcc_cols = _expand_mfcc_columns(df)
    else:
        mfcc_cols = []

    # Definir features disponibles
    candidates = list(ACOUSTIC_FEATURES) + list(EXTENDED_SCALAR_FEATURES) + list(mfcc_cols)
    if use_nlp:
        candidates += NLP_FEATURES
    available = [c for c in candidates if c in df.columns and df[c].notna().sum() > 0]
    print(f"Features usadas ({len(available)}):")
    print(f"  acústicas básicas : {[c for c in available if c in ACOUSTIC_FEATURES]}")
    print(f"  extendidas escalar: {[c for c in available if c in EXTENDED_SCALAR_FEATURES]}")
    print(f"  MFCC              : {[c for c in available if c in mfcc_cols]}")
    print(f"  NLP               : {[c for c in available if c in NLP_FEATURES]}")

    # NaN imputación a 0 (raro tras filtro de habla conectada, pero defensivo).
    df_feat = df[available].fillna(0.0)
    X = df_feat.values.astype(float)
    y = df["label"].astype(int).values

    # GROUPS: subject_id si existe, si no patient_ref, si no source+índice
    if "subject_id" in df.columns and df["subject_id"].notna().any():
        groups = df["subject_id"].fillna(df["patient_ref"].fillna(df["source"])).values
    elif "patient_ref" in df.columns:
        groups = df["patient_ref"].fillna(df["source"]).values
    else:
        groups = df.index.astype(str).values

    print("Distribución de clases:")
    print(f"  PD (label=1): {(y == 1).sum()}")
    print(f"  HC (label=0): {(y == 0).sum()}")
    print(f"Sujetos únicos: {len(np.unique(groups))}")
    return df, X, y, groups, available


# ---------------------------------------------------------------------------
# Métricas operativas para la pantalla de umbrales
# ---------------------------------------------------------------------------


def operating_points(y_true: np.ndarray, y_proba: np.ndarray) -> dict:
    """Devuelve umbrales sugeridos según criterios clínicos clásicos."""
    fpr, tpr, thr = roc_curve(y_true, y_proba)
    # Youden
    j = tpr - fpr
    j_idx = int(np.argmax(j))
    # Sensibilidad >= 0.90 (cribado)
    sens_idx_arr = np.where(tpr >= 0.90)[0]
    sens_idx = int(sens_idx_arr[0]) if len(sens_idx_arr) else int(np.argmax(tpr))
    # Especificidad >= 0.95 (confirmación / alerta crítica)
    spec_idx_arr = np.where((1 - fpr) >= 0.95)[0]
    spec_idx = int(spec_idx_arr[-1]) if len(spec_idx_arr) else int(np.argmin(fpr))

    def pack(i: int, name: str) -> dict:
        return {
            "name": name,
            "threshold": float(thr[i]) if i < len(thr) else 0.5,
            "sensitivity": float(tpr[i]),
            "specificity": float(1 - fpr[i]),
        }

    return {
        "youden": pack(j_idx, "Youden (max sens+spec)"),
        "screening_sens90": pack(sens_idx, "Cribado: Sens≥0.90"),
        "confirmatory_spec95": pack(spec_idx, "Confirmación: Spec≥0.95"),
    }


def evaluate(y_true: np.ndarray, y_proba: np.ndarray, threshold: float = 0.5) -> dict:
    y_pred = (y_proba >= threshold).astype(int)
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    tn, fp, fn, tp = cm.ravel()
    return {
        "auc_roc": round(float(roc_auc_score(y_true, y_proba)), 4),
        "sensitivity": round(float(tp / (tp + fn) if (tp + fn) else 0), 4),
        "specificity": round(float(tn / (tn + fp) if (tn + fp) else 0), 4),
        "precision": round(float(precision_score(y_true, y_pred, zero_division=0)), 4),
        "f1": round(float(f1_score(y_true, y_pred, zero_division=0)), 4),
        "confusion_matrix": {"TP": int(tp), "TN": int(tn), "FP": int(fp), "FN": int(fn)},
        "threshold": threshold,
    }


# ---------------------------------------------------------------------------
# Entrenamiento
# ---------------------------------------------------------------------------


def train(X: np.ndarray, y: np.ndarray, groups: np.ndarray, feature_names: list[str]) -> dict:
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    n_unique_groups = len(np.unique(groups))
    n_splits = max(2, min(5, n_unique_groups, np.bincount(y).min()))
    cv = GroupKFold(n_splits=n_splits)
    print(f"Validación: GroupKFold(n_splits={n_splits}) sobre {n_unique_groups} sujetos")

    models = {
        "LogisticRegression": LogisticRegression(
            max_iter=1000, class_weight="balanced", random_state=42,
        ),
        "RandomForest": RandomForestClassifier(
            n_estimators=200, max_depth=8, random_state=42, class_weight="balanced",
        ),
        "XGBoost": XGBClassifier(
            n_estimators=200, max_depth=4, learning_rate=0.05, random_state=42,
            eval_metric="logloss", use_label_encoder=False,
            scale_pos_weight=(y == 0).sum() / max((y == 1).sum(), 1),
        ),
    }

    all_metrics = {}
    best_name, best_auc, best_proba = "", -1.0, None
    for name, model in models.items():
        try:
            y_proba = cross_val_predict(
                model, X_scaled, y, cv=cv, groups=groups, method="predict_proba",
            )[:, 1]
        except Exception as exc:  # noqa: BLE001
            print(f"  {name}: error en CV → {exc}")
            continue
        m = evaluate(y, y_proba, threshold=0.5)
        m["operating_points"] = operating_points(y, y_proba)
        all_metrics[name] = m
        print(f"\n  >>> {name}")
        print(f"      AUC={m['auc_roc']:.4f}  Sens={m['sensitivity']:.3f}  Spec={m['specificity']:.3f}  F1={m['f1']:.3f}")
        for tag, op in m["operating_points"].items():
            print(f"      {tag:<22} thr={op['threshold']:.3f} sens={op['sensitivity']:.3f} spec={op['specificity']:.3f}")
        if m["auc_roc"] > best_auc:
            best_auc, best_name, best_proba = m["auc_roc"], name, y_proba

    if best_name == "":
        raise RuntimeError("Ningún modelo entrenó correctamente")

    print(f"\n>>> Mejor modelo: {best_name} (AUC={best_auc:.4f})")

    # Modelo final entrenado con TODO + calibración isotónica
    best_model = models[best_name]
    best_model.fit(X_scaled, y)
    cv_calib = max(2, min(3, n_splits))
    calibrated = CalibratedClassifierCV(best_model, cv=cv_calib, method="isotonic")
    calibrated.fit(X_scaled, y)

    # Importancias
    importances = None
    if hasattr(best_model, "feature_importances_"):
        importances = best_model.feature_importances_
    elif hasattr(best_model, "coef_"):
        importances = np.abs(best_model.coef_).ravel()
    if importances is not None:
        fi = sorted(zip(feature_names, importances), key=lambda x: x[1], reverse=True)
        print("\nFeature importance:")
        for f, i in fi:
            print(f"  {f:<20} {float(i):.4f}")
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
        "best_proba": best_proba.tolist() if best_proba is not None else None,
    }


def save(result: dict) -> None:
    out_model = Path(MODEL_OUTPUT_PATH)
    out_model.parent.mkdir(parents=True, exist_ok=True)
    bundle = {
        "model": result["model"],
        "raw_model": result["raw_model"],
        "scaler": result["scaler"],
        "features": result["features"],
        "model_name": result["best_model_name"],
    }
    joblib.dump(bundle, str(out_model))
    print(f"\nModelo guardado: {out_model}")

    out_metrics = Path(EVIDENCE_DIR) / "metrics_v2.json"
    out_metrics.parent.mkdir(parents=True, exist_ok=True)
    with out_metrics.open("w", encoding="utf-8") as fh:
        json.dump(
            {k: v for k, v in result["metrics"].items() if k != "best_proba"},
            fh, indent=2, ensure_ascii=False,
        )
    print(f"Métricas guardadas: {out_metrics}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Entrenamiento v2 (GroupKFold + habla conectada)")
    p.add_argument("--include-vowels", action="store_true",
                   help="Incluir vocales sostenidas además de habla conectada (no recomendado)")
    p.add_argument("--no-nlp", dest="use_nlp", action="store_false", default=True,
                   help="Ablación: usar solo features acústicas, ignorar NLP")
    p.add_argument("--no-mfcc", dest="use_mfcc", action="store_false", default=True,
                   help="Ablación: ignorar MFCC (útil para descartar leakage de dominio)")
    p.add_argument("--exclude-young-hc", action="store_true",
                   help="Excluir HC_young (controla sesgo por edad PD-mayor vs HC-joven)")
    args = p.parse_args(argv)

    print("=" * 60)
    print("  ENTRENAMIENTO v2 — habla conectada + GroupKFold")
    print("=" * 60)

    df, X, y, groups, feats = load_training_data(
        include_vowels=args.include_vowels,
        use_nlp=args.use_nlp,
        use_mfcc=args.use_mfcc,
        exclude_young_hc=args.exclude_young_hc,
    )
    if len(np.unique(y)) < 2:
        raise SystemExit("Solo hay una clase en los datos. Necesitas tanto HC como PD.")
    if len(np.unique(groups)) < 4:
        raise SystemExit(
            f"Solo {len(np.unique(groups))} sujetos únicos; mínimo 4 para GroupKFold."
            " Necesitas más datos."
        )

    result = train(X, y, groups, feats)
    save(result)

    print("\n" + "=" * 60)
    print("  ENTRENAMIENTO COMPLETADO")
    print("  Revisa los `operating_points` para configurar la pantalla de Umbrales")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
