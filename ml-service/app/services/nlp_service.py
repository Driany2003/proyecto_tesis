import logging
import re
from pathlib import Path

import whisper
import librosa

from app.config import settings
from app.core.exceptions import TranscriptionError
from app.schemas.nlp import NLPMetrics, NLPResponse
from app.services.audio_service import cleanup_audio, download_audio

logger = logging.getLogger("ml-service.nlp")

_whisper_model = None

FILLERS_ES = {"eh", "um", "uhm", "este", "pues", "bueno", "o sea", "emm", "erm", "ah"}


def get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        logger.info("Cargando modelo Whisper '%s'...", settings.whisper_model_size)
        _whisper_model = whisper.load_model(settings.whisper_model_size)
        logger.info("Modelo Whisper cargado")
    return _whisper_model


def compute_nlp_metrics(transcript: str, duration_sec: float) -> NLPMetrics:
    """Calcula métricas lingüísticas a partir de la transcripción."""
    clean = transcript.strip().lower()
    words = re.findall(r"\b\w+\b", clean)
    word_count = len(words)
    unique_words = len(set(words))

    ttr = unique_words / word_count if word_count > 0 else 0.0
    words_per_min = (word_count / duration_sec) * 60 if duration_sec > 0 else 0.0
    avg_word_length = sum(len(w) for w in words) / word_count if word_count > 0 else 0.0

    sentences = re.split(r"[.!?]+", clean)
    sentence_count = len([s for s in sentences if s.strip()])

    filler_count = sum(1 for w in words if w in FILLERS_ES)

    # Estimación de pause_ratio basada en densidad de palabras
    expected_wpm = 150.0
    expected_words = (duration_sec / 60) * expected_wpm
    pause_ratio = max(0.0, 1.0 - (word_count / expected_words)) if expected_words > 0 else 0.0

    return NLPMetrics(
        word_count=word_count,
        unique_words=unique_words,
        ttr=round(ttr, 4),
        words_per_min=round(words_per_min, 2),
        avg_word_length=round(avg_word_length, 2),
        sentence_count=sentence_count,
        filler_count=filler_count,
        pause_ratio=round(min(pause_ratio, 1.0), 4),
    )


async def transcribe_and_analyze(
    session_id: str, patient_id: str, audio_uri: str
) -> NLPResponse:
    """Pipeline: descarga audio → Whisper → métricas NLP."""
    audio_path = await download_audio(audio_uri)

    try:
        model = get_whisper_model()

        y, sr = librosa.load(str(audio_path), sr=16000)
        duration_sec = len(y) / sr

        try:
            result = model.transcribe(
                str(audio_path),
                language="es",
                fp16=False,
            )
        except Exception as exc:
            raise TranscriptionError(f"Whisper falló: {exc}") from exc

        transcript = result.get("text", "").strip()
        detected_lang = result.get("language", "es")

        if not transcript:
            logger.warning("Transcripción vacía para session=%s", session_id)
            transcript = ""

        metrics = compute_nlp_metrics(transcript, duration_sec)

        logger.info(
            "NLP completado: session=%s, words=%d, ttr=%.3f, wpm=%.1f",
            session_id, metrics.word_count, metrics.ttr, metrics.words_per_min,
        )

        return NLPResponse(
            session_id=session_id,
            patient_id=patient_id,
            whisper=True,
            transcript=transcript,
            language=detected_lang,
            metrics=metrics,
            ttr=metrics.ttr,
            words_per_min=metrics.words_per_min,
        )
    finally:
        cleanup_audio(audio_path)
