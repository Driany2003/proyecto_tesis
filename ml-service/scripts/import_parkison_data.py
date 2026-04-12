"""
Importa el dataset PARKISON_DATA (audios reales + demographics).
- Lee el Excel para obtener label, age, sex
- Procesa cada audio: limpieza de ruido + extracción de features
- Sube a MinIO (raw + cleaned)
- Guarda en training_samples en PostgreSQL
"""

import os
import sys
import uuid
from pathlib import Path

import librosa
import noisereduce as nr
import numpy as np
import pandas as pd
import parselmouth
import psycopg2
import soundfile as sf
from minio import Minio
from parselmouth.praat import call

sys.path.insert(0, str(Path(__file__).parent))
from config import DB_CONFIG, MINIO_CONFIG

EXCEL_PATH = "/Users/gio/Downloads/PARKISON_DATA/Demographics_age_sex.xlsx"
HC_DIR = "/tmp/parkison_explore/HC_SI_PARKINSON/HC_AH"
PD_DIR = "/tmp/parkison_explore/PD_NO_PARKINSON/PD_AH"
TMP_DIR = "/tmp/parkinson_pipeline"


def get_minio_client() -> Minio:
    return Minio(
        MINIO_CONFIG["endpoint"],
        access_key=MINIO_CONFIG["access_key"],
        secret_key=MINIO_CONFIG["secret_key"],
        secure=MINIO_CONFIG["secure"],
    )


def clean_audio(audio_path: str, output_path: str) -> dict:
    y, sr = librosa.load(audio_path, sr=16000)
    rms_before = float(np.sqrt(np.mean(y**2)))
    y_clean = nr.reduce_noise(y=y, sr=sr, prop_decrease=0.8, stationary=True)
    rms_after = float(np.sqrt(np.mean(y_clean**2)))
    sf.write(output_path, y_clean, sr)
    return {"rms_before": round(rms_before, 6), "rms_after": round(rms_after, 6)}


def extract_features(audio_path: str) -> dict:
    snd = parselmouth.Sound(audio_path)

    pitch = call(snd, "To Pitch", 0.0, 75.0, 600.0)
    f0_values = pitch.selected_array["frequency"]
    f0_voiced = f0_values[f0_values > 0]

    if len(f0_voiced) == 0:
        f0_mean = f0_std = 0.0
    else:
        f0_mean = float(np.mean(f0_voiced))
        f0_std = float(np.std(f0_voiced))

    point_process = call(snd, "To PointProcess (periodic, cc)", 75.0, 600.0)
    jitter = call(point_process, "Get jitter (local)", 0.0, 0.0, 0.0001, 0.02, 1.3)
    shimmer = call(
        [snd, point_process], "Get shimmer (local)", 0.0, 0.0, 0.0001, 0.02, 1.3, 1.6
    )

    harmonicity = call(snd, "To Harmonicity (cc)", 0.01, 75.0, 0.1, 1.0)
    hnr = call(harmonicity, "Get mean", 0.0, 0.0)
    nhr = 1.0 / (10 ** (hnr / 10)) if hnr > 0 else 1.0

    return {
        "f0_mean": round(f0_mean, 4),
        "f0_std": round(f0_std, 4),
        "jitter": round(jitter, 6),
        "shimmer": round(shimmer, 6),
        "hnr": round(hnr, 4),
        "nhr": round(nhr, 6),
    }


def main():
    print("=" * 60)
    print("  IMPORTACIÓN — Dataset PARKISON_DATA (audios reales)")
    print("=" * 60)

    df_demo = pd.read_excel(EXCEL_PATH, sheet_name="Parselmouth")
    print(f"\nDemographics: {len(df_demo)} muestras")
    print(f"  HC (Sanos): {(df_demo['Label'] == 'HC').sum()}")
    print(f"  PwPD (Parkinson): {(df_demo['Label'] == 'PwPD').sum()}")

    demo_map = {}
    for _, row in df_demo.iterrows():
        demo_map[row["Sample ID"]] = {
            "label": row["Label"] == "PwPD",
            "age": int(row["Age"]) if pd.notna(row["Age"]) else None,
            "sex": str(row["Sex"]) if pd.notna(row["Sex"]) else None,
        }

    hc_files = {f: False for f in os.listdir(HC_DIR) if f.endswith(".wav")}
    pd_files = {f: True for f in os.listdir(PD_DIR) if f.endswith(".wav")}

    all_files = []
    for fname, is_pd_folder in {**{f: False for f in hc_files}, **{f: True for f in pd_files}}.items():
        sample_id = fname.replace(".wav", "")
        audio_dir = PD_DIR if is_pd_folder else HC_DIR
        audio_path = os.path.join(audio_dir, fname)

        demo = demo_map.get(sample_id, {})
        label = demo.get("label", is_pd_folder)

        all_files.append({
            "sample_id": sample_id,
            "audio_path": audio_path,
            "label": label,
            "age": demo.get("age"),
            "sex": demo.get("sex"),
        })

    print(f"\nTotal audios encontrados: {len(all_files)}")

    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    cur.execute("DELETE FROM training_samples WHERE source = 'parkison_data'")
    conn.commit()

    minio_client = get_minio_client()
    Path(TMP_DIR).mkdir(parents=True, exist_ok=True)

    processed = 0
    errors = 0

    for i, item in enumerate(all_files):
        sample_id = item["sample_id"]
        label_str = "Parkinson" if item["label"] else "Sano"

        try:
            print(f"\n[{i+1}/{len(all_files)}] {sample_id[:40]}... ({label_str})")

            uid = str(uuid.uuid4())[:8]
            cleaned_path = os.path.join(TMP_DIR, f"cleaned_{uid}.wav")

            print("  Limpiando ruido...")
            clean_stats = clean_audio(item["audio_path"], cleaned_path)

            print("  Extrayendo features...")
            features = extract_features(cleaned_path)
            print(f"  F0={features['f0_mean']}Hz, jitter={features['jitter']}, "
                  f"shimmer={features['shimmer']}, HNR={features['hnr']}dB")

            raw_minio = f"raw/parkison_data/{sample_id}.wav"
            clean_minio = f"cleaned/parkison_data/{sample_id}_clean.wav"

            print("  Subiendo a MinIO...")
            minio_client.fput_object(MINIO_CONFIG["bucket"], raw_minio, item["audio_path"])
            minio_client.fput_object(MINIO_CONFIG["bucket"], clean_minio, cleaned_path)

            cur.execute(
                """
                INSERT INTO training_samples
                    (source, label, patient_ref, minio_raw_path, minio_cleaned_path,
                     f0_mean, f0_std, jitter, shimmer, hnr, nhr, age, sex)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    "parkison_data",
                    item["label"],
                    sample_id[:20],
                    raw_minio,
                    clean_minio,
                    features["f0_mean"],
                    features["f0_std"],
                    features["jitter"],
                    features["shimmer"],
                    features["hnr"],
                    features["nhr"],
                    item["age"],
                    item["sex"],
                ),
            )
            conn.commit()

            os.unlink(cleaned_path)
            processed += 1

        except Exception as e:
            errors += 1
            print(f"  ERROR: {e}")
            continue

    cur.close()
    conn.close()

    print(f"\n{'='*60}")
    print(f"  IMPORTACIÓN COMPLETADA")
    print(f"  Procesados: {processed}/{len(all_files)}")
    print(f"  Errores: {errors}")
    print(f"{'='*60}")

    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    cur.execute("""
        SELECT source, label, COUNT(*) FROM training_samples
        GROUP BY source, label ORDER BY source, label
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    print("\n=== Resumen total training_samples ===")
    for source, label, count in rows:
        tag = "Parkinson" if label else "Sano"
        print(f"  {source:<20} {tag:<12} {count}")


if __name__ == "__main__":
    main()
