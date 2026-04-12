from pydantic import BaseModel, Field


class PredictRequest(BaseModel):
    session_id: str
    patient_id: str
    clinical: dict = Field(default_factory=dict)
    acoustic: dict = Field(default_factory=dict, description="Features acústicas del paso anterior")
    nlp: dict = Field(default_factory=dict, description="Métricas NLP del paso anterior")


class FeatureImportance(BaseModel):
    feature: str
    importance: float


class PredictResponse(BaseModel):
    session_id: str
    patient_id: str
    p_parkinson: float = Field(..., ge=0, le=1, description="Probabilidad estimada de Parkinson")
    ci_low: float = Field(..., ge=0, le=1, description="Límite inferior IC 95%")
    ci_high: float = Field(..., ge=0, le=1, description="Límite superior IC 95%")
    risk_band: str = Field(..., description="Banda de riesgo: low, moderate, high, very_high")
    top_features: list[FeatureImportance] = Field(
        default_factory=list,
        description="Features más influyentes en la predicción",
    )
