import logging

from fastapi import APIRouter

from app.schemas.nlp import NLPRequest, NLPResponse
from app.services.nlp_service import transcribe_and_analyze

logger = logging.getLogger("ml-service.api.nlp")
router = APIRouter(prefix="/nlp", tags=["NLP"])


@router.post("/transcribe-and-metrics", response_model=NLPResponse)
async def transcribe_and_metrics_endpoint(req: NLPRequest):
    """
    Transcribe audio con Whisper y calcula métricas lingüísticas:
    TTR, palabras por minuto, muletillas, ratio de pausas, etc.
    """
    logger.info("Transcripción + NLP: session=%s", req.session_id)
    return await transcribe_and_analyze(
        session_id=req.session_id,
        patient_id=req.patient_id,
        audio_uri=req.audio_uri,
    )
