from pydantic import BaseModel, Field


class NLPRequest(BaseModel):
    session_id: str
    patient_id: str
    audio_uri: str
    clinical: dict = Field(default_factory=dict)


class NLPMetrics(BaseModel):
    word_count: int = Field(..., description="Total de palabras")
    unique_words: int = Field(..., description="Palabras únicas")
    ttr: float = Field(..., description="Type-Token Ratio (diversidad léxica)")
    words_per_min: float = Field(..., description="Palabras por minuto (fluidez)")
    avg_word_length: float = Field(..., description="Longitud media de palabra")
    sentence_count: int = Field(..., description="Número de oraciones detectadas")
    filler_count: int = Field(..., description="Muletillas (eh, um, este...)")
    pause_ratio: float = Field(..., description="Proporción de pausas en el audio")


class NLPResponse(BaseModel):
    session_id: str
    patient_id: str
    whisper: bool = Field(True, description="Indica que se usó Whisper")
    transcript: str = Field(..., description="Transcripción completa del audio")
    language: str = Field("es", description="Idioma detectado")
    metrics: NLPMetrics
    ttr: float
    words_per_min: float
