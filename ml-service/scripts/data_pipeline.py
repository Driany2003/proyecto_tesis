"""
OE01 + OE04: Pipeline de procesamiento de datos.
- Limpieza de ruido en audio (noisereduce)
- Extracción de features acústicas (parselmouth/Praat)
- Transcripción + métricas NLP (Whisper)
- Normalización y estandarización
- Subida a MinIO + guardado en PostgreSQL

Uso:
    python data_pipeline.py --audio_dir /ruta/audios --label parkinson
    python data_pipeline.py --audio_dir /ruta/audios --label sano
    python data_pipeline.py --audio_file /ruta/audio.wav --label parkinson --patient_ref P001
"""

import argparse
import json
import os
import sys
import uuid
from pathlib import Path

import librosa
import noisereduce as nr
import numpy as np
import parselmouth
import psycopg2
import soundfile as sf
from minio import Minio
from parselmouth.praat import call

sys.path.insert(0, str(Path(__file__).parent))
from config import DB_CONFIG, EVIDENCE_DIR, MINIO_CONFIG


def get_minio_client() -> Minio:
    return Minio(
        MINIO_CONFIG["endpoint"],
        access_key=MINIO_CONFIG["access_key"],
        secret_key=MINIO_CONFIG["secret_key"],
        secure=MINIO_CONFIG["secure"],
    )


def clean_audio(audio_path: str, output_path: str) -> dict:
    """Aplica reducción de ruido y devuelve métricas antes/después."""
    y, sr = librosa.load(audio_path, sr=16000)

    rms_before = float(np.sqrt(np.mean(y**2)))
    snr_before = float(20 * np.log10(rms_before / (np.std(y) + 1e-10)))

    y_clean = nr.reduce_noise(y=y, sr=sr, prop_decrease=0.8, stationary=True)

    rms_after = float(np.sqrt(np.mean(y_clean**2)))
    snr_after = float(20 * np.log10(rms_after / (np.std(y_clean) + 1e-10)))

    sf.write(output_path, y_clean, sr)

    return {
        "duration_sec": round(len(y) / sr, 2),
        "sample_rate": sr,
        "rms_before": round(rms_before, 6),
        "rms_after": round(rms_after, 6),
        "snr_before_db": round(snr_before, 2),
        "snr_after_db": round(snr_after, 2),
        "noise_reduction_db": round(snr_after - snr_before, 2),
    }


def extract_acoustic_features(audio_path: str) -> dict:
    """Extrae features acústicas con Praat (parselmouth)."""
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


def upload_to_minio(client: Minio, local_path: str, minio_path: str) -> str:
    """Sube archivo a MinIO y devuelve la ruta."""
    bucket = MINIO_CONFIG["bucket"]
    client.fput_object(bucket, minio_path, local_path)
    return minio_path


def save_to_db(
    label: bool,
    patient_ref: str,
    minio_raw: str,
    minio_cleaned: str,
    features: dict,
    source: str = "own_recording",
):
    """Guarda features + metadata en PostgreSQL."""
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO training_samples
            (source, label, patient_ref, minio_raw_path, minio_cleaned_path,
             f0_mean, f0_std, jitter, shimmer, hnr, nhr)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
        """,
        (
            source,
            label,
            patient_ref,
            minio_raw,
            minio_cleaned,
            features["f0_mean"],
            features["f0_std"],
            features["jitter"],
            features["shimmer"],
            features["hnr"],
            features["nhr"],
        ),
    )
    sample_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    return sample_id


def process_single_audio(
    audio_path: str, label: bool, patient_ref: str, source: str = "own_recording"
) -> dict:
    """Pipeline completo para un solo archivo de audio."""
    audio_path = str(Path(audio_path).resolve())
    filename = Path(audio_path).stem
    uid = str(uuid.uuid4())[:8]

    tmp_dir = Path("/tmp/parkinson_pipeline")
    tmp_dir.mkdir(parents=True, exist_ok=True)
    cleaned_path = str(tmp_dir / f"{filename}_cleaned_{uid}.wav")

    print(f"\n--- Procesando: {Path(audio_path).name} ---")

    print("  [1/4] Limpieza de ruido...")
    cleaning_stats = clean_audio(audio_path, cleaned_path)
    print(f"        SNR: {cleaning_stats['snr_before_db']}dB → {cleaning_stats['snr_after_db']}dB "
          f"(mejora: +{cleaning_stats['noise_reduction_db']}dB)")

    print("  [2/4] Extracción de features acústicas...")
    features = extract_acoustic_features(cleaned_path)
    print(f"        F0={features['f0_mean']}Hz, jitter={features['jitter']}, "
          f"shimmer={features['shimmer']}, HNR={features['hnr']}dB")

    print("  [3/4] Subiendo a MinIO...")
    minio_client = get_minio_client()
    raw_path = f"raw/{patient_ref}/{filename}_{uid}.wav"
    clean_minio_path = f"cleaned/{patient_ref}/{filename}_{uid}_clean.wav"
    upload_to_minio(minio_client, audio_path, raw_path)
    upload_to_minio(minio_client, cleaned_path, clean_minio_path)
    print(f"        Raw: {raw_path}")
    print(f"        Cleaned: {clean_minio_path}")

    print("  [4/4] Guardando en PostgreSQL...")
    sample_id = save_to_db(label, patient_ref, raw_path, clean_minio_path, features, source)
    print(f"        training_samples.id = {sample_id}")

    os.unlink(cleaned_path)

    return {
        "sample_id": sample_id,
        "patient_ref": patient_ref,
        "label": "parkinson" if label else "sano",
        "features": features,
        "cleaning": cleaning_stats,
        "minio_raw": raw_path,
        "minio_cleaned": clean_minio_path,
    }


def process_directory(audio_dir: str, label: bool, source: str = "own_recording") -> list:
    """Procesa todos los audios en un directorio."""
    audio_dir = Path(audio_dir)
    extensions = {".wav", ".mp3", ".ogg", ".flac", ".m4a", ".webm"}
    files = sorted([f for f in audio_dir.iterdir() if f.suffix.lower() in extensions])

    if not files:
        print(f"No se encontraron archivos de audio en {audio_dir}")
        return []

    print(f"\nEncontrados {len(files)} archivos de audio en {audio_dir}")
    results = []
    for i, f in enumerate(files):
        patient_ref = f.stem.split("_")[0] if "_" in f.stem else f"P{i+1:03d}"
        result = process_single_audio(str(f), label, patient_ref, source)
        results.append(result)

    print(f"\n=== Procesados {len(results)} archivos ===")
    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Pipeline de procesamiento de audio para Parkinson")
    parser.add_argument("--audio_file", help="Ruta a un archivo de audio individual")
    parser.add_argument("--audio_dir", help="Ruta a directorio con archivos de audio")
    parser.add_argument("--label", required=True, choices=["parkinson", "sano"],
                        help="Etiqueta: parkinson o sano")
    parser.add_argument("--patient_ref", default=None, help="Referencia del paciente")
    parser.add_argument("--source", default="own_recording",
                        help="Fuente: own_recording, app_recording")
    args = parser.parse_args()

    label_bool = args.label == "parkinson"

    if args.audio_file:
        patient_ref = args.patient_ref or Path(args.audio_file).stem
        result = process_single_audio(args.audio_file, label_bool, patient_ref, args.source)
        print(f"\nResultado: {json.dumps(result, indent=2, ensure_ascii=False)}")
    elif args.audio_dir:
        results = process_directory(args.audio_dir, label_bool, args.source)
        print(f"\n{len(results)} muestras procesadas e insertadas.")
    else:
        print("Error: Especifica --audio_file o --audio_dir")
        sys.exit(1)
