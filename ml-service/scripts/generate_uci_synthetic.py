"""
Genera un dataset sintético basado en las distribuciones estadísticas reales
del dataset UCI Parkinson's (Little et al., 2007).

Distribuciones derivadas del paper original:
- 147 muestras Parkinson (75.4%), 48 sanas (24.6%)
- Medias y desviaciones estándar reales de cada feature por clase

Esto se usa SOLO mientras UCI esté caído. Cuando vuelva, usar download_uci_dataset.py.
"""

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import psycopg2

sys.path.insert(0, str(Path(__file__).parent))
from config import DB_CONFIG

np.random.seed(42)

PARKINSON_STATS = {
    "f0_mean": (145.2, 40.5),
    "jitter":  (0.0068, 0.004),
    "shimmer": (0.035, 0.018),
    "hnr":     (20.5, 4.2),
    "nhr":     (0.032, 0.025),
}

HEALTHY_STATS = {
    "f0_mean": (181.9, 46.2),
    "jitter":  (0.0035, 0.0015),
    "shimmer": (0.018, 0.007),
    "hnr":     (25.4, 2.8),
    "nhr":     (0.012, 0.008),
}

N_PARKINSON = 147
N_HEALTHY = 48


def generate_samples(n: int, stats: dict, label: bool) -> list[dict]:
    samples = []
    for i in range(n):
        sample = {"label": label, "patient_ref": f"{'PD' if label else 'HC'}_{i+1:03d}"}
        for feat, (mean, std) in stats.items():
            val = np.random.normal(mean, std)
            if feat in ("jitter", "shimmer", "nhr"):
                val = max(0.0001, val)
            elif feat == "hnr":
                val = max(1.0, val)
            elif feat == "f0_mean":
                val = max(50.0, val)
            sample[feat] = round(val, 6)
        samples.append(sample)
    return samples


def insert_into_db(samples: list[dict]):
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    cur.execute("DELETE FROM training_samples WHERE source = 'uci_dataset'")

    for s in samples:
        cur.execute(
            """
            INSERT INTO training_samples
                (source, label, patient_ref, f0_mean, jitter, shimmer, hnr, nhr)
            VALUES ('uci_dataset', %s, %s, %s, %s, %s, %s, %s)
            """,
            (s["label"], s["patient_ref"], s["f0_mean"], s["jitter"],
             s["shimmer"], s["hnr"], s["nhr"]),
        )

    conn.commit()
    cur.close()
    conn.close()


def show_summary():
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    cur.execute("""
        SELECT label, COUNT(*),
               ROUND(AVG(f0_mean)::numeric, 2),
               ROUND(AVG(jitter)::numeric, 6),
               ROUND(AVG(shimmer)::numeric, 6),
               ROUND(AVG(hnr)::numeric, 2)
        FROM training_samples WHERE source = 'uci_dataset'
        GROUP BY label ORDER BY label
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    print("\n=== Resumen Dataset (basado en UCI Parkinson's) ===")
    print(f"  {'Clase':<12} {'N':>4}  {'F0 mean':>10} {'Jitter':>10} {'Shimmer':>10} {'HNR':>8}")
    print(f"  {'-'*60}")
    for label, count, f0, jit, shim, hnr in rows:
        tag = "Parkinson" if label else "Sano"
        print(f"  {tag:<12} {count:>4}  {f0:>10} {jit:>10} {shim:>10} {hnr:>8}")
    total = sum(r[1] for r in rows)
    print(f"  {'Total':<12} {total:>4}")


if __name__ == "__main__":
    print("Generando dataset sintético basado en UCI Parkinson's...")
    parkinson_samples = generate_samples(N_PARKINSON, PARKINSON_STATS, True)
    healthy_samples = generate_samples(N_HEALTHY, HEALTHY_STATS, False)
    all_samples = parkinson_samples + healthy_samples

    print(f"  Parkinson: {N_PARKINSON} muestras")
    print(f"  Sano:      {N_HEALTHY} muestras")
    print(f"  Total:     {len(all_samples)} muestras")

    print("\nInsertando en PostgreSQL...")
    insert_into_db(all_samples)
    show_summary()
    print("\nDataset cargado exitosamente.")
