from fastapi import APIRouter

from app.api.v1.audio import router as audio_router
from app.api.v1.features import router as features_router
from app.api.v1.nlp import router as nlp_router
from app.api.v1.model import router as model_router
from app.api.v1.training import router as training_router

v1_router = APIRouter()

v1_router.include_router(audio_router)
v1_router.include_router(features_router)
v1_router.include_router(nlp_router)
v1_router.include_router(model_router)
v1_router.include_router(training_router)
