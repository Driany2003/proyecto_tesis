import logging

from fastapi import APIRouter

from app.schemas.audio import AudioValidateRequest, AudioValidateResponse
from app.services.audio_service import validate_audio

logger = logging.getLogger("ml-service.api.audio")
router = APIRouter(prefix="/audio", tags=["Audio"])


@router.post("/validate", response_model=AudioValidateResponse)
async def validate_audio_endpoint(req: AudioValidateRequest):
    """
    Valida la calidad y formato de un archivo de audio.
    Verifica: formato, duración, sample rate, tamaño, integridad.
    """
    logger.info("Validando audio: session=%s", req.session_id)
    return await validate_audio(session_id=req.session_id, audio_uri=req.audio_uri)
