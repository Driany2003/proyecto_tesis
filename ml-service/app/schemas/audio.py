from pydantic import BaseModel, Field


class AudioValidateRequest(BaseModel):
    session_id: str = Field(..., description="ID único de la sesión de análisis")
    patient_id: str = Field(..., description="ID del paciente")
    audio_uri: str = Field(..., description="URL o ruta del archivo de audio")


class AudioValidateResponse(BaseModel):
    valid: bool
    session_id: str
    duration_sec: float = Field(..., description="Duración del audio en segundos")
    sample_rate: int = Field(..., description="Frecuencia de muestreo en Hz")
    channels: int
    format: str
    file_size_mb: float
    warnings: list[str] = Field(default_factory=list)
