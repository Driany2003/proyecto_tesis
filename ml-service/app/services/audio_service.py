import logging
import subprocess
import uuid
from pathlib import Path
from urllib.parse import urlparse

import httpx
import librosa
import noisereduce as nr
import soundfile as sf

from app.config import settings
from app.core.exceptions import AudioDownloadError, AudioValidationError
from app.schemas.audio import AudioValidateResponse

logger = logging.getLogger("ml-service.audio")

SUPPORTED_FORMATS = {".wav", ".mp3", ".ogg", ".flac", ".m4a", ".mp4", ".aac", ".caf", ".webm"}

# Formatos que libsndfile NO sabe leer directamente y deben pasarse por ffmpeg.
# iOS/macOS suele grabar en .m4a (AAC en contenedor MP4); también .caf y .mp4.
_CONVERT_WITH_FFMPEG = frozenset({".webm", ".m4a", ".mp4", ".aac", ".caf"})


def prepare_audio_file(local_path: Path) -> tuple[Path, list[Path]]:
    suffix = local_path.suffix.lower()
    to_cleanup = [local_path]

    if suffix not in _CONVERT_WITH_FFMPEG:
        return local_path, to_cleanup

    out = local_path.parent / f"{local_path.stem}_ffmpeg.wav"
    af = (settings.audio_ffmpeg_af or "").strip()
    cmd = [
        "ffmpeg",
        "-y",
        "-nostdin",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        str(local_path),
    ]
    if af:
        cmd.extend(["-af", af])
    cmd.extend(
        [
            "-acodec",
            "pcm_s16le",
            "-ar",
            "48000",
            "-ac",
            "1",
            str(out),
        ]
    )
    conversion_failed = False
    try:
        subprocess.run(cmd, check=True, capture_output=True, timeout=600)
    except FileNotFoundError as exc:
        conversion_failed = True
        raise AudioValidationError(
            f"ffmpeg no está instalado; hace falta para convertir {suffix} a WAV."
        ) from exc
    except subprocess.TimeoutExpired as exc:
        conversion_failed = True
        raise AudioValidationError("ffmpeg superó el tiempo máximo de conversión") from exc
    except subprocess.CalledProcessError as exc:
        conversion_failed = True
        err = ""
        if exc.stderr:
            err = exc.stderr.decode(errors="replace")[:1200]
        raise AudioValidationError(f"ffmpeg no pudo convertir el audio: {err or exc}") from exc
    finally:
        if conversion_failed and out.exists():
            try:
                out.unlink()
            except OSError:
                logger.warning("No se pudo eliminar WAV parcial tras fallo: %s", out)

    to_cleanup.append(out)
    logger.info("Audio convertido con ffmpeg: %s -> %s", local_path.name, out.name)
    return out, to_cleanup


def maybe_enhance_for_ml(work_path: Path) -> tuple[Path, list[Path]]:
    if not settings.audio_apply_noisereduce:
        return work_path, []

    y, sr = librosa.load(str(work_path), sr=None, mono=True)
    y_clean = nr.reduce_noise(
        y=y,
        sr=sr,
        stationary=settings.audio_noisereduce_stationary,
        prop_decrease=settings.audio_noisereduce_prop_decrease,
    )
    out = work_path.parent / f"{work_path.stem}_nr.wav"
    sf.write(str(out), y_clean, sr)
    logger.info(
        "noisereduce: stationary=%s prop_decrease=%.2f -> %s",
        settings.audio_noisereduce_stationary,
        settings.audio_noisereduce_prop_decrease,
        out.name,
    )
    return out, [out]


async def download_audio(audio_uri: str) -> Path:
    parsed = urlparse(audio_uri)

    if parsed.scheme in ("http", "https"):
        tmp_dir = Path(settings.audio_tmp_dir)
        tmp_dir.mkdir(parents=True, exist_ok=True)
        ext = Path(parsed.path).suffix or ".wav"
        local_path = tmp_dir / f"{uuid.uuid4()}{ext}"

        download_ok = False
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.get(audio_uri)
                resp.raise_for_status()
                local_path.write_bytes(resp.content)
            download_ok = True
        except httpx.HTTPError as exc:
            raise AudioDownloadError(f"Error descargando audio: {exc}") from exc
        finally:
            if not download_ok and local_path.exists():
                try:
                    local_path.unlink()
                except OSError:
                    logger.warning(
                        "No se pudo eliminar archivo parcial tras fallo de descarga: %s",
                        local_path,
                    )

        return local_path

    local = Path(audio_uri)
    if local.exists():
        return local

    raise AudioDownloadError(f"No se puede acceder al audio: {audio_uri}")


def cleanup_audio(path: Path) -> None:
    try:
        if str(path).startswith(settings.audio_tmp_dir) and path.exists():
            path.unlink()
    except OSError:
        logger.warning("No se pudo eliminar archivo temporal: %s", path)


async def validate_audio(session_id: str, audio_uri: str) -> AudioValidateResponse:
    audio_path = await download_audio(audio_uri)
    paths_to_delete: list[Path] = [audio_path]

    try:
        ext = audio_path.suffix.lower()
        if ext not in SUPPORTED_FORMATS:
            raise AudioValidationError(f"Formato no soportado: {ext}. Use: {SUPPORTED_FORMATS}")

        file_size_mb = audio_path.stat().st_size / (1024 * 1024)
        if file_size_mb > settings.audio_max_file_size_mb:
            raise AudioValidationError(
                f"Archivo demasiado grande: {file_size_mb:.1f}MB (máx {settings.audio_max_file_size_mb}MB)"
            )

        work_path, paths_to_delete = prepare_audio_file(audio_path)

        info = sf.info(str(work_path))
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

        y, sr = librosa.load(str(work_path), sr=None, duration=2.0)
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
        for p in paths_to_delete:
            cleanup_audio(p)

