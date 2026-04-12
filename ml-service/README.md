# Parkinson ML Service

Microservicio FastAPI para análisis de voz orientado a la detección temprana de Parkinson.

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Estado del servicio |
| POST | `/v1/audio/validate` | Validar calidad de audio |
| POST | `/v1/features/acoustic` | Extraer features acústicas (F0, jitter, shimmer, HNR) |
| POST | `/v1/nlp/transcribe-and-metrics` | Transcripción Whisper + métricas lingüísticas |
| POST | `/v1/model/predict` | Predicción probabilística + IC 95% |

## Requisitos

- Python 3.11+
- ffmpeg (`brew install ffmpeg` en macOS)

## Instalación

```bash
cd ml-service
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

## Ejecución

```bash
uvicorn app.main:app --reload --port 8000
```

Documentación automática en: http://localhost:8000/docs

## Modelo ML

Coloca tu modelo entrenado en `models/parkinson_model.joblib`.

Formato esperado (joblib):
```python
import joblib
joblib.dump({
    "model": trained_model,          # sklearn estimator
    "features": ["f0_mean", "jitter", ...]  # orden de features
}, "models/parkinson_model.joblib")
```

## Docker

```bash
docker build -t parkinson-ml .
docker run -p 8000:8000 parkinson-ml
```

## Conexión con n8n

Configurar en n8n la variable de entorno:
```
PARKINSON_API_BASE=http://localhost:8000
```
