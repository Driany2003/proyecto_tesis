from pydantic import BaseModel, Field


class AcousticRequest(BaseModel):
    session_id: str
    patient_id: str
    audio_uri: str
    clinical: dict = Field(default_factory=dict)


class AcousticFeatures(BaseModel):
    f0_mean: float = Field(..., description="Frecuencia fundamental media (Hz)")
    f0_std: float = Field(..., description="Desviación estándar de F0")
    f0_min: float = Field(..., description="F0 mínimo")
    f0_max: float = Field(..., description="F0 máximo")
    jitter: float = Field(..., description="Jitter relativo (perturbación de frecuencia)")
    shimmer: float = Field(..., description="Shimmer relativo (perturbación de amplitud)")
    hnr: float = Field(..., description="Relación armónico-ruido (dB)")
    nhr: float = Field(..., description="Relación ruido-armónico")


class AcousticResponse(BaseModel):
    session_id: str
    patient_id: str
    opensmile: bool = Field(
        False, description="True solo si las features provienen de openSMILE"
    )
    engine: str = Field("praat", description="Motor utilizado: 'praat' u 'opensmile'")
    features: AcousticFeatures
    f0_mean: float
    f0_std: float
    jitter: float
    shimmer: float
    hnr: float
    nhr: float
