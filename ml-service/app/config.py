from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    app_name: str = "Parkinson ML Service"
    debug: bool = False

    # Ruta base donde se almacenan archivos de audio descargados temporalmente
    audio_tmp_dir: str = "/tmp/parkinson_audio"

    # Modelo ML serializado
    model_path: str = str(Path(__file__).resolve().parent.parent / "models" / "parkinson_model.joblib")

    # Whisper
    whisper_model_size: str = "base"

    # Umbrales de validación de audio
    audio_min_duration_sec: float = 1.0
    audio_max_duration_sec: float = 300.0
    audio_min_sample_rate: int = 8000
    audio_max_file_size_mb: float = 50.0

    # CORS
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:8080"]

    model_config = {"env_file": ".env", "env_prefix": "ML_"}


settings = Settings()
