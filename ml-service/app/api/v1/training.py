import logging

import psycopg2
from fastapi import APIRouter, BackgroundTasks

from app.schemas.training import AddSampleRequest, AddSampleResponse, RetrainResponse
from app.services.acoustic_service import analyze_acoustic
from app.services.training_service import (
    get_db_config,
    increment_sample_counter,
    retrain,
)

logger = logging.getLogger("ml-service.api.training")
router = APIRouter(prefix="/training", tags=["Training"])


@router.post("/add-sample", response_model=AddSampleResponse)
async def add_training_sample(req: AddSampleRequest, background_tasks: BackgroundTasks):
    logger.info("Nueva muestra: label=%s, patient=%s", req.label, req.patient_ref)

    result = await analyze_acoustic(
        session_id="training",
        patient_id=req.patient_ref or "unknown",
        audio_uri=req.audio_uri,
    )

    conn = psycopg2.connect(**get_db_config())
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO training_samples
            (source, label, patient_ref, minio_raw_path,
             f0_mean, f0_std, jitter, shimmer, hnr, nhr, age, sex)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
        """,
        (
            req.source,
            req.label,
            req.patient_ref,
            req.audio_uri,
            result.f0_mean,
            result.f0_std,
            result.jitter,
            result.shimmer,
            result.hnr,
            result.nhr,
            req.age,
            req.sex,
        ),
    )
    sample_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()

    should_retrain = increment_sample_counter()
    if should_retrain:
        logger.info("Umbral alcanzado, disparando re-entrenamiento en background...")
        background_tasks.add_task(retrain)

    return AddSampleResponse(
        sample_id=sample_id,
        features_extracted={
            "f0_mean": result.f0_mean,
            "jitter": result.jitter,
            "shimmer": result.shimmer,
            "hnr": result.hnr,
        },
        retrain_triggered=should_retrain,
        message="Muestra agregada" + (" — re-entrenamiento iniciado" if should_retrain else ""),
    )


@router.post("/retrain", response_model=RetrainResponse)
async def retrain_model():
    logger.info("Re-entrenamiento manual solicitado")
    metrics = await retrain()
    return RetrainResponse(**metrics)


@router.get("/stats")
async def training_stats():
    conn = psycopg2.connect(**get_db_config())
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) FROM training_samples")
    total = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM training_samples WHERE label = true")
    parkinson = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM training_samples WHERE label = false")
    sano = cur.fetchone()[0]

    cur.execute("SELECT source, COUNT(*) FROM training_samples GROUP BY source")
    sources = dict(cur.fetchall())

    cur.close()
    conn.close()

    return {
        "total_samples": total,
        "parkinson": parkinson,
        "sano": sano,
        "sources": sources,
        "balance_ratio": round(parkinson / max(sano, 1), 2),
    }
