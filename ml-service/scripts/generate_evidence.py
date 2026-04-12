"""
Generador de evidencia visual para la tesis.

Genera gráficos para OE01, OE02 y OE04:
- Distribución del dataset
- Distribución de features por clase
- Curva ROC con AUC e IC 95%
- Matriz de confusión
- Curva de calibración
- Feature importance
- Comparación de modelos
- Tabla de métricas con IC

Uso:
    python generate_evidence.py
"""

import json
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import psycopg2
import seaborn as sns

sys.path.insert(0, str(Path(__file__).parent))
from config import DB_CONFIG, EVIDENCE_DIR

OUT = Path(__file__).parent / EVIDENCE_DIR
OUT.mkdir(parents=True, exist_ok=True)

sns.set_theme(style="whitegrid", font_scale=1.1)
COLORS = {"parkinson": "#e74c3c", "sano": "#2ecc71"}


def load_data() -> pd.DataFrame:
    conn = psycopg2.connect(**DB_CONFIG)
    df = pd.read_sql("SELECT * FROM training_samples ORDER BY created_at", conn)
    conn.close()
    df["clase"] = df["label"].map({True: "Parkinson", False: "Sano"})
    return df


def load_metrics() -> dict:
    metrics_path = OUT / "metrics.json"
    if not metrics_path.exists():
        print("  Advertencia: metrics.json no encontrado. Ejecuta train_model.py primero.")
        return {}
    with open(metrics_path) as f:
        return json.load(f)


# ─────────────────────────── OE01: Dataset ───────────────────────────

def plot_dataset_summary(df: pd.DataFrame):
    """Distribución de clases y fuentes del dataset."""
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    counts = df["clase"].value_counts()
    axes[0].bar(counts.index, counts.values,
                color=[COLORS["parkinson"], COLORS["sano"]])
    axes[0].set_title("Distribución de Clases")
    axes[0].set_ylabel("Número de muestras")
    for i, (cls, val) in enumerate(counts.items()):
        axes[0].text(i, val + 1, str(val), ha="center", fontweight="bold", fontsize=13)

    source_counts = df.groupby(["source", "clase"]).size().unstack(fill_value=0)
    source_counts.plot(kind="bar", ax=axes[1],
                       color=[COLORS["sano"], COLORS["parkinson"]])
    axes[1].set_title("Muestras por Fuente y Clase")
    axes[1].set_ylabel("Número de muestras")
    axes[1].set_xticklabels(axes[1].get_xticklabels(), rotation=0)
    axes[1].legend(title="Clase")

    plt.tight_layout()
    path = OUT / "dataset_summary.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  Guardado: {path.name}")


def plot_feature_distributions(df: pd.DataFrame):
    """Box plots de cada feature por clase."""
    features = ["f0_mean", "jitter", "shimmer", "hnr", "nhr"]
    available = [f for f in features if f in df.columns and df[f].notna().sum() > 0]

    n = len(available)
    if n == 0:
        print("  Sin features para graficar distribuciones.")
        return

    fig, axes = plt.subplots(1, n, figsize=(4 * n, 5))
    if n == 1:
        axes = [axes]

    titles = {
        "f0_mean": "F0 Media (Hz)",
        "jitter": "Jitter (rel.)",
        "shimmer": "Shimmer (rel.)",
        "hnr": "HNR (dB)",
        "nhr": "NHR",
    }

    for i, feat in enumerate(available):
        sns.boxplot(data=df, x="clase", y=feat, ax=axes[i],
                    palette={"Parkinson": COLORS["parkinson"], "Sano": COLORS["sano"]})
        axes[i].set_title(titles.get(feat, feat))
        axes[i].set_xlabel("")

    plt.suptitle("Distribución de Features Acústicas por Clase", fontsize=14, fontweight="bold", y=1.02)
    plt.tight_layout()
    path = OUT / "feature_distributions.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  Guardado: {path.name}")


# ─────────────────────────── OE02: Modelo ───────────────────────────

def plot_roc_curve(metrics: dict):
    """Curva ROC con AUC e IC 95% para cada modelo."""
    fig, ax = plt.subplots(figsize=(8, 7))
    colors = {"RandomForest": "#3498db", "XGBoost": "#e67e22"}

    for name, m in metrics.items():
        if not isinstance(m, dict) or "roc_curve" not in m:
            continue
        fpr = m["roc_curve"]["fpr"]
        tpr = m["roc_curve"]["tpr"]
        auc_val = m["auc_roc"]
        ci = m.get("auc_ci95", [0, 0])
        ax.plot(fpr, tpr, label=f"{name} (AUC={auc_val:.3f}, IC95%=[{ci[0]:.3f}, {ci[1]:.3f}])",
                color=colors.get(name, "#333"), linewidth=2)

    ax.plot([0, 1], [0, 1], "k--", alpha=0.3, label="Azar (AUC=0.5)")
    ax.set_xlabel("Tasa de Falsos Positivos (1 - Especificidad)")
    ax.set_ylabel("Tasa de Verdaderos Positivos (Sensibilidad)")
    ax.set_title("Curva ROC — Detección de Parkinson", fontweight="bold")
    ax.legend(loc="lower right")
    ax.set_xlim([0, 1])
    ax.set_ylim([0, 1.02])

    plt.tight_layout()
    path = OUT / "roc_curve.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  Guardado: {path.name}")


def plot_confusion_matrix(metrics: dict):
    """Matriz de confusión para cada modelo."""
    model_metrics = {k: v for k, v in metrics.items() if isinstance(v, dict) and "confusion_matrix" in v}
    n = len(model_metrics)
    if n == 0:
        return

    fig, axes = plt.subplots(1, n, figsize=(6 * n, 5))
    if n == 1:
        axes = [axes]

    for i, (name, m) in enumerate(model_metrics.items()):
        cm = m["confusion_matrix"]
        matrix = np.array([[cm["TN"], cm["FP"]], [cm["FN"], cm["TP"]]])
        sns.heatmap(matrix, annot=True, fmt="d", cmap="Blues", ax=axes[i],
                    xticklabels=["Sano", "Parkinson"],
                    yticklabels=["Sano", "Parkinson"],
                    annot_kws={"size": 16})
        axes[i].set_xlabel("Predicción")
        axes[i].set_ylabel("Real")
        axes[i].set_title(f"Matriz de Confusión — {name}")

    plt.tight_layout()
    path = OUT / "confusion_matrix.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  Guardado: {path.name}")


def plot_calibration_curve(metrics: dict):
    """Curva de calibración (reliability diagram)."""
    fig, ax = plt.subplots(figsize=(8, 7))
    colors = {"RandomForest": "#3498db", "XGBoost": "#e67e22"}

    for name, m in metrics.items():
        if not isinstance(m, dict) or "calibration" not in m:
            continue
        cal = m["calibration"]
        if not cal["prob_true"]:
            continue
        ax.plot(cal["prob_pred"], cal["prob_true"], "o-",
                label=f"{name} (Brier={m.get('brier_score', 0):.4f})",
                color=colors.get(name, "#333"), linewidth=2)

    ax.plot([0, 1], [0, 1], "k--", alpha=0.3, label="Calibración perfecta")
    ax.set_xlabel("Probabilidad predicha")
    ax.set_ylabel("Proporción real de positivos")
    ax.set_title("Curva de Calibración", fontweight="bold")
    ax.legend(loc="lower right")
    ax.set_xlim([0, 1])
    ax.set_ylim([0, 1.02])

    plt.tight_layout()
    path = OUT / "calibration_curve.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  Guardado: {path.name}")


def plot_feature_importance(metrics: dict):
    """Gráfico de importancia de features."""
    fi = metrics.get("feature_importance")
    if not fi:
        print("  Sin datos de feature importance.")
        return

    fig, ax = plt.subplots(figsize=(8, 5))
    names = [f["feature"] for f in fi]
    values = [f["importance"] for f in fi]
    colors = plt.cm.viridis(np.linspace(0.3, 0.9, len(names)))

    bars = ax.barh(names[::-1], values[::-1], color=colors[::-1])
    ax.set_xlabel("Importancia")
    ax.set_title("Importancia de Features en el Modelo", fontweight="bold")

    for bar, val in zip(bars, values[::-1]):
        ax.text(bar.get_width() + 0.005, bar.get_y() + bar.get_height() / 2,
                f"{val:.4f}", va="center", fontsize=10)

    plt.tight_layout()
    path = OUT / "feature_importance.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  Guardado: {path.name}")


def plot_model_comparison(metrics: dict):
    """Tabla visual comparando métricas de ambos modelos."""
    model_metrics = {k: v for k, v in metrics.items() if isinstance(v, dict) and "accuracy" in v}
    if len(model_metrics) < 2:
        print("  Se necesitan al menos 2 modelos para comparar.")
        return

    metric_names = ["accuracy", "sensitivity_recall", "specificity", "precision", "f1_score", "auc_roc", "brier_score"]
    labels = ["Accuracy", "Sensibilidad", "Especificidad", "Precisión", "F1 Score", "AUC-ROC", "Brier Score"]

    fig, ax = plt.subplots(figsize=(10, 4))
    ax.axis("off")

    headers = ["Métrica"] + list(model_metrics.keys())
    table_data = []
    for metric, label in zip(metric_names, labels):
        row = [label]
        for name, m in model_metrics.items():
            val = m.get(metric, 0)
            ci_key = f"{metric.split('_')[0]}_ci95" if metric != "brier_score" else None
            ci = m.get(ci_key) if ci_key else None
            if ci:
                row.append(f"{val:.4f} [{ci[0]:.4f}, {ci[1]:.4f}]")
            else:
                row.append(f"{val:.4f}")
        table_data.append(row)

    table = ax.table(cellText=table_data, colLabels=headers, loc="center", cellLoc="center")
    table.auto_set_font_size(False)
    table.set_fontsize(10)
    table.scale(1.2, 1.8)

    for j in range(len(headers)):
        table[0, j].set_facecolor("#3498db")
        table[0, j].set_text_props(color="white", fontweight="bold")

    ax.set_title("Comparación de Modelos — Métricas de Evaluación",
                 fontweight="bold", fontsize=13, pad=20)

    plt.tight_layout()
    path = OUT / "model_comparison.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  Guardado: {path.name}")


def generate_metrics_table(metrics: dict):
    """Tabla de métricas con IC 95% para el documento de tesis."""
    model_metrics = {k: v for k, v in metrics.items() if isinstance(v, dict) and "accuracy" in v}

    fig, ax = plt.subplots(figsize=(12, 5))
    ax.axis("off")

    headers = ["Métrica", "Valor", "IC 95%", "Interpretación"]
    best = max(model_metrics.items(), key=lambda x: x[1].get("auc_roc", 0))
    m = best[1]
    name = best[0]

    interpretations = {
        "sensitivity_recall": "Capacidad de detectar Parkinson",
        "specificity": "Capacidad de identificar sanos",
        "precision": "Confiabilidad de predicción positiva",
        "auc_roc": "Poder discriminativo global",
        "brier_score": "Calibración (menor es mejor)",
    }

    rows = []
    for metric, interp in interpretations.items():
        val = m.get(metric, 0)
        ci_key = metric.split("_")[0] + "_ci95"
        ci = m.get(ci_key)
        ci_str = f"[{ci[0]:.4f}, {ci[1]:.4f}]" if ci else "—"
        rows.append([metric.replace("_", " ").title(), f"{val:.4f}", ci_str, interp])

    table = ax.table(cellText=rows, colLabels=headers, loc="center", cellLoc="center")
    table.auto_set_font_size(False)
    table.set_fontsize(10)
    table.scale(1.3, 1.8)

    for j in range(len(headers)):
        table[0, j].set_facecolor("#2c3e50")
        table[0, j].set_text_props(color="white", fontweight="bold")

    ax.set_title(f"Métricas de Evaluación — {name} (con IC 95%)",
                 fontweight="bold", fontsize=13, pad=20)

    plt.tight_layout()
    path = OUT / "metrics_table.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  Guardado: {path.name}")


if __name__ == "__main__":
    print("=" * 60)
    print("  GENERACIÓN DE EVIDENCIA PARA TESIS")
    print("=" * 60)

    print("\n[OE01] Cargando datos...")
    df = load_data()
    metrics = load_metrics()

    print("\n[OE01] Generando resumen del dataset...")
    plot_dataset_summary(df)
    plot_feature_distributions(df)

    if metrics:
        print("\n[OE02] Generando evidencia del modelo...")
        plot_roc_curve(metrics)
        plot_confusion_matrix(metrics)
        plot_calibration_curve(metrics)
        plot_feature_importance(metrics)
        plot_model_comparison(metrics)
        generate_metrics_table(metrics)
    else:
        print("\n[OE02] Sin métricas. Ejecuta train_model.py primero.")

    print(f"\n{'='*60}")
    print(f"  Evidencia generada en: {OUT.resolve()}")
    print(f"{'='*60}")
