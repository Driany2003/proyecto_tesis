import logging
import os
import uuid
from pathlib import Path
from urllib.parse import urlparse

import httpx
import librosa
import soundfile as sf

from app.config import settings
from app.core.exceptions import AudioDownloadError, AudioValidationError
from app.schemas.audio import AudioValidateResponse

logger = logging.getLogger("ml-service.audio")

SUPPORTED_FORMATS = {".wav", ".mp3", ".ogg", ".flac", ".m4a", ".webm"}


async def download_audio(audio_uri: str) -> Path:
    """Descarga el audio desde una URI remota o resuelve una ruta local."""
    parsed = urlparse(audio_uri)

    if parsed.scheme in ("http", "https"):
        tmp_dir = Path(settings.audio_tmp_dir)
        tmp_dir.mkdir(parents=True, exist_ok=True)
        ext = Path(parsed.path).suffix or ".wav"
        local_path = tmp_dir / f"{uuid.uuid4()}{ext}"

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.get(audio_uri)
                resp.raise_for_status()
                local_path.write_bytes(resp.content)
        except httpx.HTTPError as exc:
            raise AudioDownloadError(f"Error descargando audio: {exc}") from exc

        return local_path

    local = Path(audio_uri)
    if local.exists():
        return local

    raise AudioDownloadError(f"No se puede acceder al audio: {audio_uri}")


def cleanup_audio(path: Path) -> None:
    """Elimina archivos temporales de audio."""
    try:
        if str(path).startswith(settings.audio_tmp_dir) and path.exists():
            path.unlink()
    except OSError:
        logger.warning("No se pudo eliminar archivo temporal: %s", path)


async def validate_audio(session_id: str, audio_uri: str) -> AudioValidateResponse:
    """Valida formato, duración, sample rate y tamaño del audio."""
    audio_path = await download_audio(audio_uri)

    try:
        ext = audio_path.suffix.lower()
        if ext not in SUPPORTED_FORMATS:
            raise AudioValidationError(f"Formato no soportado: {ext}. Use: {SUPPORTED_FORMATS}")

        file_size_mb = audio_path.stat().st_size / (1024 * 1024)
        if file_size_mb > settings.audio_max_file_size_mb:
            raise AudioValidationError(
                f"Archivo demasiado grande: {file_size_mb:.1f}MB (máx {settings.audio_max_file_size_mb}MB)"
            )

        info = sf.info(str(audio_path))
        duration = info.duration
        sample_rate = info.samplerate
        channels = info.channels
        fmt = info.format

        warnings: list[str] = []

        if duration < settings.audio_min_duration_sec:
            raise AudioValidationError(
                f"Audio demasiado corto: {duration:.1f}s (mín {settings.audio_min_duration_sec}s)"
            )
        if duration > settings.audio_max_duration_sec:
            raise AudioValidationError(
                f"Audio demasiado largo: {duration:.1f}s (máx {settings.audio_max_duration_sec}s)"
            )

        if sample_rate < settings.audio_min_sample_rate:
            raise AudioValidationError(
                f"Sample rate muy bajo: {sample_rate}Hz (mín {settings.audio_min_sample_rate}Hz)"
            )

        if channels > 1:
            warnings.append("Audio multicanal detectado; se usará solo el canal izquierdo")

        if sample_rate < 16000:
            warnings.append(f"Sample rate bajo ({sample_rate}Hz); recomendado ≥16kHz para mejor precisión")

        # Verificar que librosa puede cargar el archivo (integridad)
        y, sr = librosa.load(str(audio_path), sr=None, duration=2.0)
        if len(y) == 0:
            raise AudioValidationError("El archivo de audio está vacío o corrupto")

        logger.info("Audio validado: session=%s, dur=%.1fs, sr=%d", session_id, duration, sample_rate)

        return AudioValidateResponse(
            valid=True,
            session_id=session_id,
            duration_sec=round(duration, 2),
            sample_rate=sample_rate,
            channels=channels,
            format=fmt,
            file_size_mb=round(file_size_mb, 3),
            warnings=warnings,
        )
    finally:
        cleanup_audio(audio_path)
