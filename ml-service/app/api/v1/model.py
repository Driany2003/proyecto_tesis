import logging

from fastapi import APIRouter

from app.schemas.model import PredictRequest, PredictResponse
from app.services.model_service import predict

logger = logging.getLogger("ml-service.api.model")
router = APIRouter(prefix="/model", tags=["Model"])


@router.post("/predict", response_model=PredictResponse)
async def predict_endpoint(req: PredictRequest):
    """
    Ejecuta el modelo probabilístico de detección de Parkinson.
    Recibe features acústicas + NLP + datos clínicos.
    Devuelve: probabilidad, IC 95%, banda de riesgo, top features.
    """
    logger.info("Predicción: session=%s", req.session_id)
    return await predict(
        session_id=req.session_id,
        patient_id=req.patient_id,
        acoustic=req.acoustic,
        nlp=req.nlp,
        clinical=req.clinical,
    )
