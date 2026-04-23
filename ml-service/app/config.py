from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    app_name: str = "Parkinson ML Service"
    debug: bool = False

    audio_tmp_dir: str = "/tmp/parkinson_audio"
    model_path: str = str(Path(__file__).resolve().parent.parent / "models" / "parkinson_model.joblib")
    whisper_model_size: str = "base"

    audio_min_duration_sec: float = 1.0
    audio_max_duration_sec: float = 300.0
    audio_min_sample_rate: int = 8000
    audio_max_file_size_mb: float = 50.0

    audio_ffmpeg_af: str = "highpass=f=100"

    audio_apply_noisereduce: bool = True
    audio_noisereduce_stationary: bool = False
    audio_noisereduce_prop_decrease: float = 0.75

    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:8080"]

    db_host: str = ""
    db_port: int = 5432
    db_name: str = ""
    db_user: str = ""
    db_password: str = ""

    model_config = {"env_file": ".env", "env_prefix": "ML_"}


settings = Settings()
