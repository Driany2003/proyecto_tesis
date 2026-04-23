import logging
from pathlib import Path

import numpy as np
import joblib

from app.config import settings
from app.core.exceptions import ModelNotFoundError
from app.schemas.model import FeatureImportance, PredictResponse

logger = logging.getLogger("ml-service.model")

_model = None
_scaler = None
_model_features: list[str] = []

FEATURE_ORDER = [
    "f0_mean", "f0_std", "jitter", "shimmer", "hnr", "nhr",
    "ttr", "words_per_min", "pause_ratio", "filler_count",
    "age", "symptom_onset_months",
]

RISK_BANDS = [
    (0.3, "low"),
    (0.5, "moderate"),
    (0.7, "high"),
]


def get_risk_band(probability: float) -> str:
    for threshold, band in RISK_BANDS:
        if probability < threshold:
            return band
    return "very_high"


def load_model():
    global _model, _scaler, _model_features
    model_path = Path(settings.model_path)

    if not model_path.exists():
        logger.warning("Modelo no encontrado en %s", model_path)
        return None

    bundle = joblib.load(model_path)

    if isinstance(bundle, dict):
        _model = bundle.get("model")
        _scaler = bundle.get("scaler")
        _model_features = bundle.get("features", FEATURE_ORDER)
    else:
        _model = bundle
        _scaler = None
        _model_features = FEATURE_ORDER

    logger.info(
        "Modelo cargado: %s (scaler=%s, features=%d)",
        type(_model).__name__,
        type(_scaler).__name__ if _scaler is not None else "ninguno",
        len(_model_features),
    )
    return _model


def build_feature_vector(acoustic: dict, nlp: dict, clinical: dict) -> np.ndarray:
    raw = {**acoustic, **nlp, **clinical}

    if "features" in raw and isinstance(raw["features"], dict):
        raw.update(raw.pop("features"))
    if "metrics" in raw and isinstance(raw["metrics"], dict):
        raw.update(raw.pop("metrics"))

    features = _model_features if _model_features else FEATURE_ORDER
    vector = []
    for feat in features:
        val = raw.get(feat, 0.0)
        try:
            vector.append(float(val))
        except (TypeError, ValueError):
            vector.append(0.0)

    return np.array(vector).reshape(1, -1)


def compute_confidence_interval(
    model, X: np.ndarray, confidence: float = 0.95
) -> tuple[float, float, float]:
    if hasattr(model, "estimators_"):
        preds = np.array([est.predict(X)[0] if not hasattr(est, "predict_proba")
                          else est.predict_proba(X)[0][1]
                          for est in model.estimators_])
        p_mean = float(np.mean(preds))
        alpha = 1 - confidence
        ci_low = float(np.percentile(preds, 100 * alpha / 2))
        ci_high = float(np.percentile(preds, 100 * (1 - alpha / 2)))
    elif hasattr(model, "predict_proba"):
        proba = model.predict_proba(X)
        p_mean = float(proba[0][1]) if proba.shape[1] > 1 else float(proba[0][0])
        se = 0.05
        ci_low = max(0.0, p_mean - 1.96 * se)
        ci_high = min(1.0, p_mean + 1.96 * se)
    else:
        p_mean = float(model.predict(X)[0])
        ci_low = max(0.0, p_mean - 0.1)
        ci_high = min(1.0, p_mean + 0.1)

    return (
        round(np.clip(p_mean, 0, 1), 4),
        round(np.clip(ci_low, 0, 1), 4),
        round(np.clip(ci_high, 0, 1), 4),
    )


def get_feature_importances(model, feature_names: list[str]) -> list[FeatureImportance]:
    importances = None

    if hasattr(model, "feature_importances_"):
        importances = model.feature_importances_
    elif hasattr(model, "coef_"):
        importances = np.abs(model.coef_[0]) if model.coef_.ndim > 1 else np.abs(model.coef_)

    if importances is None:
        return []

    pairs = sorted(zip(feature_names, importances), key=lambda x: x[1], reverse=True)
    return [
        FeatureImportance(feature=name, importance=round(float(imp), 4))
        for name, imp in pairs[:5]
    ]


async def predict(
    session_id: str,
    patient_id: str,
    acoustic: dict,
    nlp: dict,
    clinical: dict,
) -> PredictResponse:
    global _model

    if _model is None:
        _model = load_model()

    if _model is None:
        raise ModelNotFoundError()

    X = build_feature_vector(acoustic, nlp, clinical)
    features_used = _model_features if _model_features else FEATURE_ORDER

    if _scaler is not None:
        try:
            X = _scaler.transform(X)
        except Exception as exc:
            logger.error("Fallo aplicando scaler en inferencia: %s", exc)
            raise

    p_parkinson, ci_low, ci_high = compute_confidence_interval(_model, X)
    risk_band = get_risk_band(p_parkinson)
    top_features = get_feature_importances(_model, features_used)

    logger.info(
        "Predicción: session=%s, p=%.4f [%.4f, %.4f], risk=%s",
        session_id, p_parkinson, ci_low, ci_high, risk_band,
    )

    return PredictResponse(
        session_id=session_id,
        patient_id=patient_id,
        p_parkinson=p_parkinson,
        ci_low=ci_low,
        ci_high=ci_high,
        risk_band=risk_band,
        top_features=top_features,
    )
