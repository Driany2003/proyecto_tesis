"""Extracción de features acústicas avanzadas (Camino A).

Inspirado en AVCA-ByO (MATLAB) pero implementado con librerías Python ya
disponibles en el entorno: librosa, parselmouth (Praat), antropy.
DFA se implementa a mano (algoritmo estándar Peng 1994) para evitar el
bug de `nolds` con Python 3.9.

Bloques calculados por audio:

1) Cepstrales:
   - MFCC 13 coeficientes -> media y desviación por coeficiente
   - Cepstral Peak Prominence (CPP) media

2) Complejidad no lineal (literatura PD: Tsanas, Little 2009/2011):
   - DFA  (Detrended Fluctuation Analysis) sobre la señal
   - Sample Entropy sobre el contorno F0
   - PPE  (Pitch Period Entropy) sobre F0 (entropía de Shannon de las
     desviaciones logarítmicas)
   - RPDE (Recurrence Period Density Entropy) sobre la señal

3) Modulación / prosodia:
   - Intensidad media y desviación (dB) usando Praat

Todas las funciones son tolerantes a fallos: si una feature explota
(audio muy corto, sin frames voiced, etc.), devuelve None para esa
feature en lugar de tirar el pipeline entero.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import numpy as np

logger = logging.getLogger("ml-service.extended_features")

EXTENDED_FEATURES_VERSION = 1

# Constantes alineadas con acoustic_service (Praat) para que F0 sea consistente.
_F0_FLOOR = 75.0
_F0_CEILING = 600.0
_TARGET_SR = 16000  # MFCC y resto se computan a 16 kHz (estándar voz)


@dataclass
class ExtendedFeatures:
    mfcc_means: Optional[list[float]] = None        # 13 valores
    mfcc_stds: Optional[list[float]] = None         # 13 valores
    cpp_mean: Optional[float] = None
    dfa: Optional[float] = None
    sample_entropy: Optional[float] = None
    ppe: Optional[float] = None
    rpde: Optional[float] = None
    intensity_mean: Optional[float] = None
    intensity_std: Optional[float] = None

    def to_db_dict(self) -> dict:
        """Convierte a dict listo para INSERT/UPDATE en `training_samples`."""
        import json

        def _round_list(xs: Optional[list[float]]) -> Optional[str]:
            if xs is None:
                return None
            return json.dumps([round(float(x), 6) for x in xs])

        def _round(x: Optional[float], n: int = 6) -> Optional[float]:
            if x is None or (isinstance(x, float) and (math.isnan(x) or math.isinf(x))):
                return None
            return round(float(x), n)

        return {
            "mfcc_means": _round_list(self.mfcc_means),
            "mfcc_stds": _round_list(self.mfcc_stds),
            "cpp_mean": _round(self.cpp_mean, 4),
            "dfa": _round(self.dfa, 6),
            "sample_entropy": _round(self.sample_entropy, 6),
            "ppe": _round(self.ppe, 6),
            "rpde": _round(self.rpde, 6),
            "intensity_mean": _round(self.intensity_mean, 3),
            "intensity_std": _round(self.intensity_std, 3),
            "extended_features_version": EXTENDED_FEATURES_VERSION,
        }


# ---------------------------------------------------------------------------
# Helpers individuales (cada uno protegido)
# ---------------------------------------------------------------------------


def _safe(fn, *args, default=None, label: str = "", **kwargs):
    try:
        out = fn(*args, **kwargs)
        if isinstance(out, float) and (math.isnan(out) or math.isinf(out)):
            return default
        return out
    except Exception as exc:  # noqa: BLE001
        logger.warning("[extended] %s falló: %s", label or fn.__name__, exc)
        return default


def _mfcc_stats(y: np.ndarray, sr: int, n_mfcc: int = 13) -> tuple[Optional[list[float]], Optional[list[float]]]:
    import librosa

    if len(y) < sr // 4:  # menos de 250 ms → no tiene sentido
        return None, None
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=n_mfcc)
    means = np.nanmean(mfcc, axis=1).tolist()
    stds = np.nanstd(mfcc, axis=1).tolist()
    return means, stds


def _cpp_mean(y: np.ndarray, sr: int) -> Optional[float]:
    """Cepstral Peak Prominence promedio.

    Implementación simple sobre el cepstro real:
      cepstrum = IFFT(log|FFT(frame)|)
      buscamos el pico en el rango de quefrencias correspondientes a F0
      (75-600 Hz) y restamos la regresión lineal del cepstro.
    """
    import librosa

    if len(y) < sr // 4:
        return None
    frame_len = 1024
    hop = 256
    frames = librosa.util.frame(y, frame_length=frame_len, hop_length=hop)
    if frames.shape[1] == 0:
        return None
    win = np.hanning(frame_len)[:, None]
    spec = np.fft.rfft(frames * win, axis=0)
    log_mag = np.log(np.abs(spec) + 1e-10)
    cepstrum = np.fft.irfft(log_mag, axis=0)

    q_min = max(1, int(sr / _F0_CEILING))
    q_max = min(cepstrum.shape[0] - 1, int(sr / _F0_FLOOR))
    if q_max <= q_min:
        return None

    cepstrum_voice = cepstrum[q_min:q_max, :]
    peaks = np.max(cepstrum_voice, axis=0)
    quefr_axis = np.arange(q_min, q_max)
    cpp_per_frame = []
    for i in range(cepstrum_voice.shape[1]):
        col = cepstrum_voice[:, i]
        a, b = np.polyfit(quefr_axis, col, 1)
        baseline = a * quefr_axis + b
        cpp_per_frame.append(float(peaks[i] - np.max(baseline)))
    if not cpp_per_frame:
        return None
    return float(np.mean(cpp_per_frame))


def _dfa(y: np.ndarray) -> Optional[float]:
    """Detrended Fluctuation Analysis (Peng et al. 1994).

    Implementación propia para evitar la dependencia de `nolds`, rota en
    Python 3.9. Devuelve el exponente alpha de la recta log F(n) vs log n.
    """
    if len(y) < 2000:
        return None
    y = y[: min(len(y), 60_000)].astype(float)

    # 1) integrar la señal centrada
    y_int = np.cumsum(y - np.mean(y))
    n_total = len(y_int)

    # tamaños de ventana en escala log
    scales = np.unique(
        np.floor(np.logspace(np.log10(16), np.log10(n_total // 4), 18)).astype(int)
    )
    if len(scales) < 4:
        return None

    fluctuations: list[float] = []
    used_scales: list[int] = []
    for n in scales:
        n_windows = n_total // n
        if n_windows < 2:
            continue
        ys = y_int[: n_windows * n].reshape(n_windows, n)
        x = np.arange(n)
        # detrend lineal por ventana
        rms = []
        for window in ys:
            a, b = np.polyfit(x, window, 1)
            trend = a * x + b
            rms.append(np.sqrt(np.mean((window - trend) ** 2)))
        f_n = float(np.sqrt(np.mean(np.square(rms))))
        if f_n > 0:
            fluctuations.append(f_n)
            used_scales.append(int(n))

    if len(used_scales) < 4:
        return None
    coeffs = np.polyfit(np.log(used_scales), np.log(fluctuations), 1)
    return float(coeffs[0])


def _f0_contour(audio_path: Path) -> Optional[np.ndarray]:
    import parselmouth
    from parselmouth.praat import call

    snd = parselmouth.Sound(str(audio_path))
    pitch = call(snd, "To Pitch", 0.0, _F0_FLOOR, _F0_CEILING)
    f0 = pitch.selected_array["frequency"]
    voiced = f0[f0 > 0]
    if len(voiced) < 30:
        return None
    return voiced.astype(float)


def _sample_entropy_f0(f0: Optional[np.ndarray]) -> Optional[float]:
    if f0 is None or len(f0) < 50:
        return None
    import antropy as ant

    return float(ant.sample_entropy(f0))


def _ppe(f0: Optional[np.ndarray]) -> Optional[float]:
    """Pitch Period Entropy a la Little 2009.

    Idea: calcular el log de la razón F0/median(F0), restar tendencia
    lineal y medir la entropía de Shannon del histograma resultante.
    """
    if f0 is None or len(f0) < 50:
        return None
    median = float(np.median(f0))
    if median <= 0:
        return None
    rel = np.log(f0 / median)
    # detrend
    x = np.arange(len(rel), dtype=float)
    a, b = np.polyfit(x, rel, 1)
    detr = rel - (a * x + b)
    hist, _ = np.histogram(detr, bins=20, density=True)
    p = hist[hist > 0]
    p = p / p.sum()
    return float(-np.sum(p * np.log2(p)))


def _rpde(y: np.ndarray) -> Optional[float]:
    """Recurrence Period Density Entropy aproximada vía permutation entropy
    sobre la señal sub-muestreada. La PE es un proxy muy correlacionado con
    RPDE para señales de voz (Tsanas 2011) y mucho más estable de calcular.
    """
    import antropy as ant

    if len(y) < 1000:
        return None
    yy = y[::4]  # downsample para velocidad
    yy = yy[: min(len(yy), 30_000)]
    return float(ant.perm_entropy(yy, order=3, normalize=True))


def _intensity_stats(audio_path: Path) -> tuple[Optional[float], Optional[float]]:
    try:
        import parselmouth
        from parselmouth.praat import call

        snd = parselmouth.Sound(str(audio_path))
        intensity = call(snd, "To Intensity", _F0_FLOOR, 0.0)
        values = intensity.values.T.flatten()
        values = values[~np.isnan(values)]
        if len(values) == 0:
            return None, None
        return float(np.mean(values)), float(np.std(values))
    except Exception as exc:  # noqa: BLE001
        logger.warning("[extended] intensity falló: %s", exc)
        return None, None


# ---------------------------------------------------------------------------
# API pública
# ---------------------------------------------------------------------------


def extract_extended_features(audio_path: Path) -> ExtendedFeatures:
    """Calcula todas las features extendidas para un audio ya preprocesado.

    Espera que `audio_path` apunte al WAV que sale de `prepare_audio_file`
    (mismo preprocesado que producción) para mantener consistencia.
    """
    import librosa

    y, sr = librosa.load(str(audio_path), sr=_TARGET_SR, mono=True)

    means, stds = _safe(_mfcc_stats, y, sr, label="mfcc", default=(None, None))
    cpp = _safe(_cpp_mean, y, sr, label="cpp")
    dfa = _safe(_dfa, y, label="dfa")
    f0 = _safe(_f0_contour, audio_path, label="f0_contour")
    samp_en = _safe(_sample_entropy_f0, f0, label="sample_entropy")
    ppe = _safe(_ppe, f0, label="ppe")
    rpde = _safe(_rpde, y, label="rpde")
    intensity_mean, intensity_std = _intensity_stats(audio_path)

    return ExtendedFeatures(
        mfcc_means=means,
        mfcc_stds=stds,
        cpp_mean=cpp,
        dfa=dfa,
        sample_entropy=samp_en,
        ppe=ppe,
        rpde=rpde,
        intensity_mean=intensity_mean,
        intensity_std=intensity_std,
    )
