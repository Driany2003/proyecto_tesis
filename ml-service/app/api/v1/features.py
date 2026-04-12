import logging

from fastapi import APIRouter

from app.schemas.features import AcousticRequest, AcousticResponse
from app.services.acoustic_service import analyze_acoustic

logger = logging.getLogger("ml-service.api.features")
router = APIRouter(prefix="/features", tags=["Features"])


@router.post("/acoustic", response_model=AcousticResponse)
async def acoustic_analysis_endpoint(req: AcousticRequest):
    """
    Extrae features acústicas del audio: F0, jitter, shimmer, HNR.
    Usa Praat (parselmouth) internamente.
    """
    logger.info("Análisis acústico: session=%s", req.session_id)
    return await analyze_acoustic(
        session_id=req.session_id,
        patient_id=req.patient_id,
        audio_uri=req.audio_uri,
    )
