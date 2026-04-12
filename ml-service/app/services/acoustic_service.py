import logging
from pathlib import Path

import numpy as np
import parselmouth
from parselmouth.praat import call

from app.schemas.features import AcousticFeatures, AcousticResponse
from app.services.audio_service import cleanup_audio, download_audio, prepare_audio_file

logger = logging.getLogger("ml-service.acoustic")


def extract_acoustic_features(audio_path: Path) -> AcousticFeatures:
    """Extrae features acústicas usando Praat (parselmouth)."""
    snd = parselmouth.Sound(str(audio_path))

    # --- Pitch (F0) ---
    pitch = call(snd, "To Pitch", 0.0, 75.0, 600.0)
    f0_values = pitch.selected_array["frequency"]
    f0_voiced = f0_values[f0_values > 0]

    if len(f0_voiced) == 0:
        logger.warning("No se detectaron frames voiced en el audio")
        f0_mean = f0_std = f0_min = f0_max = 0.0
    else:
        f0_mean = float(np.mean(f0_voiced))
        f0_std = float(np.std(f0_voiced))
        f0_min = float(np.min(f0_voiced))
        f0_max = float(np.max(f0_voiced))

    # --- Jitter ---
    point_process = call(snd, "To PointProcess (periodic, cc)", 75.0, 600.0)
    jitter = call(point_process, "Get jitter (local)", 0.0, 0.0, 0.0001, 0.02, 1.3)

    # --- Shimmer ---
    shimmer = call(
        [snd, point_process], "Get shimmer (local)", 0.0, 0.0, 0.0001, 0.02, 1.3, 1.6
    )

    # --- HNR ---
    harmonicity = call(snd, "To Harmonicity (cc)", 0.01, 75.0, 0.1, 1.0)
    hnr = call(harmonicity, "Get mean", 0.0, 0.0)

    nhr = 1.0 / (10 ** (hnr / 10)) if hnr > 0 else 1.0

    logger.info(
        "Features extraídas: F0=%.1fHz, jitter=%.4f, shimmer=%.4f, HNR=%.1fdB",
        f0_mean, jitter, shimmer, hnr,
    )

    return AcousticFeatures(
        f0_mean=round(f0_mean, 3),
        f0_std=round(f0_std, 3),
        f0_min=round(f0_min, 3),
        f0_max=round(f0_max, 3),
        jitter=round(jitter, 6),
        shimmer=round(shimmer, 6),
        hnr=round(hnr, 3),
        nhr=round(nhr, 6),
    )


async def analyze_acoustic(session_id: str, patient_id: str, audio_uri: str) -> AcousticResponse:
    """Pipeline completo: descarga → extrae features acústicas."""
    audio_path = await download_audio(audio_uri)
    paths_to_delete: list[Path] = [audio_path]

    try:
        work_path, paths_to_delete = prepare_audio_file(audio_path)
        features = extract_acoustic_features(work_path)

        return AcousticResponse(
            session_id=session_id,
            patient_id=patient_id,
            opensmile=True,
            features=features,
            f0_mean=features.f0_mean,
            f0_std=features.f0_std,
            jitter=features.jitter,
            shimmer=features.shimmer,
            hnr=features.hnr,
            nhr=features.nhr,
        )
    finally:
        for p in paths_to_delete:
            cleanup_audio(p)
