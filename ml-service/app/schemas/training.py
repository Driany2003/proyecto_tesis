from pydantic import BaseModel, Field


class AddSampleRequest(BaseModel):
    audio_uri: str = Field(..., description="URL del audio en MinIO o remota")
    label: bool = Field(..., description="True = Parkinson, False = Sano")
    patient_ref: str = Field(None, description="Referencia anonimizada del paciente")
    source: str = Field("app_recording", description="Fuente: app_recording, own_recording")
    age: int = Field(None, description="Edad del paciente")
    sex: str = Field(None, description="Sexo: M o F")


class AddSampleResponse(BaseModel):
    sample_id: int
    features_extracted: dict
    retrain_triggered: bool
    message: str


class RetrainResponse(BaseModel):
    model_name: str
    samples: int
    auc_roc: float
    sensitivity: float
    specificity: float
    precision: float
    f1_score: float
    message: str = "Modelo re-entrenado exitosamente"
