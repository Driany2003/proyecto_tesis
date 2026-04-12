from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.core.logging import setup_logging
from app.api.v1.router import v1_router

logger = setup_logging(settings.debug)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Path(settings.audio_tmp_dir).mkdir(parents=True, exist_ok=True)
    logger.info("ML Service iniciado — modelo: %s", settings.model_path)
    yield
    logger.info("ML Service detenido")


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="Microservicio de análisis de voz para detección temprana de Parkinson",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(v1_router, prefix="/v1")


@app.get("/health", tags=["infra"])
async def health():
    model_exists = Path(settings.model_path).exists()
    return {
        "status": "ok",
        "model_loaded": model_exists,
        "whisper_model": settings.whisper_model_size,
    }
