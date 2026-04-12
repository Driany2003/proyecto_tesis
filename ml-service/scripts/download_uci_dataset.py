"""
OE01: Descarga el dataset UCI Parkinson's e inserta las muestras en training_samples.
Dataset: https://archive.ics.uci.edu/ml/datasets/parkinsons

195 muestras, 23 features acústicas pre-extraídas, etiqueta binaria (status).
"""

import io
import sys
from pathlib import Path

import pandas as pd
import psycopg2

sys.path.insert(0, str(Path(__file__).parent))
from config import DB_CONFIG

UCI_URLS = [
    "https://archive.ics.uci.edu/ml/machine-learning-databases/parkinsons/parkinsons.data",
    "https://raw.githubusercontent.com/jbrownlee/Datasets/master/parkinsons.csv",
]

FEATURE_MAP = {
    "MDVP:Fo(Hz)": "f0_mean",
    "MDVP:Jitter(%)": "jitter",
    "MDVP:Shimmer": "shimmer",
    "MDVP:RAP": None,
    "MDVP:PPQ": None,
    "Jitter:DDP": None,
    "MDVP:Shimmer(dB)": None,
    "Shimmer:APQ3": None,
    "Shimmer:APQ5": None,
    "MDVP:APQ": None,
    "Shimmer:DDA": None,
    "NHR": "nhr",
    "HNR": "hnr",
    "RPDE": None,
    "DFA": None,
    "spread1": None,
    "spread2": None,
    "D2": None,
    "PPE": None,
}


def download_and_parse() -> pd.DataFrame:
    print("Descargando dataset UCI Parkinson's...")
    for url in UCI_URLS:
        try:
            print(f"  Intentando: {url[:60]}...")
            df = pd.read_csv(url)
            print(f"  Descargado: {len(df)} muestras, {len(df.columns)} columnas")
            return df
        except Exception as e:
            print(f"  Falló: {e}")
    raise RuntimeError("No se pudo descargar el dataset de ninguna fuente.")


def insert_into_db(df: pd.DataFrame):
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) FROM training_samples WHERE source = 'uci_dataset'")
    existing = cur.fetchone()[0]
    if existing > 0:
        print(f"  Ya existen {existing} muestras UCI en la BD. Limpiando...")
        cur.execute("DELETE FROM training_samples WHERE source = 'uci_dataset'")
        conn.commit()

    inserted = 0
    for _, row in df.iterrows():
        label = bool(row["status"] == 1)
        patient_ref = row["name"]

        extra = {}
        for uci_col, mapped in FEATURE_MAP.items():
            if mapped is None and uci_col in row.index:
                extra[uci_col] = float(row[uci_col])

        extra["RPDE"] = float(row.get("RPDE", 0))
        extra["DFA"] = float(row.get("DFA", 0))
        extra["spread1"] = float(row.get("spread1", 0))
        extra["spread2"] = float(row.get("spread2", 0))
        extra["D2"] = float(row.get("D2", 0))
        extra["PPE"] = float(row.get("PPE", 0))

        cur.execute(
            """
            INSERT INTO training_samples
                (source, label, patient_ref, f0_mean, jitter, shimmer, hnr, nhr, extra_features)
            VALUES
                ('uci_dataset', %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
            """,
            (
                label,
                patient_ref,
                float(row["MDVP:Fo(Hz)"]),
                float(row["MDVP:Jitter(%)"]),
                float(row["MDVP:Shimmer"]),
                float(row["HNR"]),
                float(row["NHR"]),
                pd.io.json.dumps(extra),
            ),
        )
        inserted += 1

    conn.commit()
    cur.close()
    conn.close()
    print(f"  Insertadas {inserted} muestras UCI en training_samples")


def show_summary():
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    cur.execute(
        """
        SELECT label, COUNT(*) FROM training_samples
        WHERE source = 'uci_dataset'
        GROUP BY label ORDER BY label
        """
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()

    print("\n=== Resumen Dataset UCI ===")
    for label, count in rows:
        tag = "Parkinson" if label else "Sano"
        print(f"  {tag}: {count} muestras")
    total = sum(r[1] for r in rows)
    print(f"  Total: {total} muestras")


if __name__ == "__main__":
    df = download_and_parse()
    insert_into_db(df)
    show_summary()
    print("\nDataset UCI cargado exitosamente.")
