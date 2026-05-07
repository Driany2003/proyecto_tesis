"""Utilidades compartidas para ingestar datasets externos al pipeline.

Este módulo concentra TODO lo que es común a la ingesta de cualquier corpus
externo (NeuroVoz, Italian Parkinson, etc.) para evitar duplicación:

  - extracción de features acústicas con el MISMO Praat que usa producción
    (importado directamente de `app.services.acoustic_service`)
  - extracción de features NLP con el MISMO Whisper que usa producción
    (importado de `app.services.nlp_service`)
  - inserción en la tabla `training_samples` ya migrada (ver migrations/001).

La idea es que NUNCA haya un mismatch de unidades / preprocesado entre los
datos con los que entrenamos y los datos que llegan en producción.
"""

from __future__ import annotations

import logging
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import psycopg2

# Permitir importar `app.*` desde scripts/datasets/
_ML_SERVICE_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_ML_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(_ML_SERVICE_ROOT))

# Defaults de entorno para que el pipeline cargue aunque no haya .env
os.environ.setdefault("ML_AUDIO_TMP_DIR", "/tmp/parkinson_ingest")
os.environ.setdefault("ML_WHISPER_MODEL_SIZE", os.environ.get("ML_WHISPER_MODEL_SIZE", "base"))
# Ingesta masiva: sin noisereduce (menos archivos _nr en /tmp) y alineado con evitar
# ventanas largas entre Praat/Whisper donde el temp podría dejar de ser válido.
os.environ.setdefault("ML_AUDIO_APPLY_NOISEREDUCE", "false")
# Cache de Whisper dentro del workspace para evitar problemas de permisos
# en ~/.cache/whisper cuando se corre desde sandboxes / contenedores.
os.environ.setdefault(
    "ML_WHISPER_CACHE_DIR",
    str((_ML_SERVICE_ROOT / ".cache" / "whisper").resolve()),
)

# `scripts/config.py` evalúa MINIO_CONFIG al importarse (`_required_env`).
# La ingesta NO usa MinIO (los WAVs ya están en disco), así que ponemos
# valores dummy para que el `import` no truene.
os.environ.setdefault("ML_MINIO_ENDPOINT", "unused:9000")
os.environ.setdefault("ML_MINIO_ACCESS_KEY", "unused")
os.environ.setdefault("ML_MINIO_SECRET_KEY", "unused")

# Importes pesados (Praat / Whisper) y de config se hacen LAZY en
# `_get_pipeline()` y `_get_db_config()` para que `download` e `info`
# funcionen sin requerir la DB ni pagar el costo de cargar Whisper.
sys.path.insert(0, str(_ML_SERVICE_ROOT / "scripts"))


def _get_pipeline():
    from app.services.acoustic_service import extract_acoustic_features
    from app.services.audio_service import maybe_enhance_for_ml, prepare_audio_file
    from app.services.extended_features_service import extract_extended_features
    from app.services.nlp_service import compute_nlp_metrics, get_whisper_model
    return {
        "extract_acoustic_features": extract_acoustic_features,
        "extract_extended_features": extract_extended_features,
        "maybe_enhance_for_ml": maybe_enhance_for_ml,
        "prepare_audio_file": prepare_audio_file,
        "compute_nlp_metrics": compute_nlp_metrics,
        "get_whisper_model": get_whisper_model,
    }


def _get_db_config():
    from config import DB_CONFIG  # noqa: PLC0415
    return DB_CONFIG

logger = logging.getLogger("ingest")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")


# ---------------------------------------------------------------------------
# Modelos
# ---------------------------------------------------------------------------


@dataclass
class IngestSample:
    """Una muestra a ingestar (ya descargada localmente)."""

    audio_path: Path
    label: bool                          # True = Parkinson, False = sano
    subject_id: str                      # ID único de paciente DENTRO del corpus
    source: str                          # 'neurovoz' | 'italian_parkinson' | ...
    task_type: str                       # 'sustained_vowel' | 'reading' | 'monologue' | 'listen_repeat'
    language: str                        # 'es' | 'it' | 'en' | ...
    age: Optional[int] = None
    sex: Optional[str] = None            # 'M' | 'F' | None
    extra: dict = field(default_factory=dict)


@dataclass
class IngestStats:
    processed: int = 0
    skipped: int = 0
    errors: int = 0
    error_msgs: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Pipeline reutilizable
# ---------------------------------------------------------------------------


def process_one_sample(sample: IngestSample, run_nlp: bool = True) -> dict:
    """Aplica el MISMO pipeline de producción a un audio externo.

    Devuelve un dict con todas las columnas listas para INSERT.
    """
    audio_path = sample.audio_path
    paths_to_delete: list[Path] = []

    pipeline = _get_pipeline()
    nlp_tasks = {"reading", "monologue", "listen_repeat"}
    # La primera carga de Whisper puede tardar minutos (descarga del .pt). Si
    # ocurre DESPUÉS de crear un WAV intermedio (_nr) bajo /tmp, en ese intervalo
    # el fichero puede dejar de existir o quedar inaccesible → transcribe falla.
    if run_nlp and sample.task_type in nlp_tasks:
        pipeline["get_whisper_model"]()

    work_path, paths_to_delete = pipeline["prepare_audio_file"](audio_path)
    work_path, extra_paths = pipeline["maybe_enhance_for_ml"](work_path)
    paths_to_delete.extend(extra_paths)

    # Acústico (Praat) — siempre
    acoustic = pipeline["extract_acoustic_features"](work_path)

    # Features extendidas (MFCC + complejidad no lineal + prosodia) — siempre
    extended = pipeline["extract_extended_features"](work_path)

    record: dict = {
        "source": sample.source,
        "label": sample.label,
        "patient_ref": sample.subject_id[:64],
        "subject_id": sample.subject_id[:64],
        "task_type": sample.task_type,
        "language": sample.language,
        "f0_mean": acoustic.f0_mean,
        "f0_std": acoustic.f0_std,
        "f0_min": acoustic.f0_min,
        "f0_max": acoustic.f0_max,
        "jitter": acoustic.jitter,
        "shimmer": acoustic.shimmer,
        "hnr": acoustic.hnr,
        "nhr": acoustic.nhr,
        "minio_raw_path": str(audio_path),
        "transcript": None,
        "duration_sec": None,
        "word_count": None,
        "unique_words": None,
        "ttr": None,
        "words_per_min": None,
        "avg_word_length": None,
        "sentence_count": None,
        "filler_count": None,
        "pause_ratio": None,
    }
    record.update(extended.to_db_dict())

    if run_nlp and sample.task_type in nlp_tasks:
        try:
            import librosa

            y, sr = librosa.load(str(work_path), sr=16000)
            duration_sec = len(y) / sr if sr else 0.0

            model = pipeline["get_whisper_model"]()
            result = model.transcribe(
                str(work_path),
                language=sample.language if sample.language in ("es", "en", "it") else None,
                fp16=False,
            )
            transcript = (result.get("text") or "").strip()

            metrics = pipeline["compute_nlp_metrics"](transcript, duration_sec)
            record.update({
                "transcript": transcript,
                "duration_sec": round(duration_sec, 3),
                "word_count": metrics.word_count,
                "unique_words": metrics.unique_words,
                "ttr": metrics.ttr,
                "words_per_min": metrics.words_per_min,
                "avg_word_length": metrics.avg_word_length,
                "sentence_count": metrics.sentence_count,
                "filler_count": metrics.filler_count,
                "pause_ratio": metrics.pause_ratio,
            })
        except Exception as exc:  # noqa: BLE001
            logger.warning("Whisper falló para %s: %s — guardo solo acústicas", audio_path.name, exc)

    # Cleanup de WAVs intermedios (no del original)
    for p in paths_to_delete:
        if p != audio_path and p.exists():
            try:
                p.unlink()
            except OSError:
                pass

    return record


# ---------------------------------------------------------------------------
# Persistencia
# ---------------------------------------------------------------------------


_INSERT_SQL = """
INSERT INTO training_samples (
    source, label, patient_ref, subject_id, task_type, language,
    f0_mean, f0_std, f0_min, f0_max, jitter, shimmer, hnr, nhr,
    minio_raw_path,
    transcript, duration_sec, word_count, unique_words, ttr,
    words_per_min, avg_word_length, sentence_count, filler_count, pause_ratio,
    mfcc_means, mfcc_stds, cpp_mean,
    dfa, sample_entropy, ppe, rpde,
    intensity_mean, intensity_std,
    extended_features_version
) VALUES (
    %(source)s, %(label)s, %(patient_ref)s, %(subject_id)s, %(task_type)s, %(language)s,
    %(f0_mean)s, %(f0_std)s, %(f0_min)s, %(f0_max)s, %(jitter)s, %(shimmer)s, %(hnr)s, %(nhr)s,
    %(minio_raw_path)s,
    %(transcript)s, %(duration_sec)s, %(word_count)s, %(unique_words)s, %(ttr)s,
    %(words_per_min)s, %(avg_word_length)s, %(sentence_count)s, %(filler_count)s, %(pause_ratio)s,
    %(mfcc_means)s, %(mfcc_stds)s, %(cpp_mean)s,
    %(dfa)s, %(sample_entropy)s, %(ppe)s, %(rpde)s,
    %(intensity_mean)s, %(intensity_std)s,
    %(extended_features_version)s
);
"""


def insert_record(record: dict) -> None:
    conn = psycopg2.connect(**_get_db_config())
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(_INSERT_SQL, record)
    finally:
        conn.close()


def delete_existing_for_source(source: str) -> int:
    """Limpia ingestas previas del mismo corpus (idempotencia)."""
    conn = psycopg2.connect(**_get_db_config())
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM training_samples WHERE source = %s", (source,))
                return cur.rowcount
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Loop genérico
# ---------------------------------------------------------------------------


def ingest_samples(samples: list[IngestSample], *, replace: bool = True, run_nlp: bool = True) -> IngestStats:
    """Procesa una lista de muestras y las inserta en `training_samples`.

    Si `replace=True`, primero borra todos los registros del mismo `source`.
    """
    stats = IngestStats()
    if not samples:
        logger.warning("Sin muestras para ingestar")
        return stats

    sources = {s.source for s in samples}
    if replace:
        for src in sources:
            n = delete_existing_for_source(src)
            logger.info("Borradas %d filas previas de source=%s", n, src)

    total = len(samples)
    for i, sample in enumerate(samples, 1):
        try:
            logger.info("[%d/%d] %s :: %s :: %s",
                        i, total, sample.source, sample.task_type, sample.audio_path.name)
            record = process_one_sample(sample, run_nlp=run_nlp)
            insert_record(record)
            stats.processed += 1
        except Exception as exc:  # noqa: BLE001
            stats.errors += 1
            stats.error_msgs.append(f"{sample.audio_path.name}: {exc}")
            logger.error("ERROR procesando %s: %s", sample.audio_path.name, exc)

    logger.info("Ingesta terminada: %d ok, %d errores", stats.processed, stats.errors)
    return stats
