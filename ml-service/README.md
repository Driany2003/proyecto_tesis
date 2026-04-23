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

---

## Configuración (`ML_*`)

Todas las variables se leen desde `.env` con prefijo **`ML_`** (ver `app/config.py`). Si no defines una variable, se usa el **valor por defecto** indicado abajo.

### General

| Variable | Default | Qué considera |
|----------|---------|----------------|
| `ML_APP_NAME` | `Parkinson ML Service` | Nombre interno de la app. |
| `ML_DEBUG` | `false` | Logs más verbosos si `true`. |
| `ML_AUDIO_TMP_DIR` | `/tmp/parkinson_audio` | Directorio donde se guardan audios descargados y WAV temporales (conversión WebM, `*_nr.wav`, etc.). Debe ser escribible por el proceso. |
| `ML_MODEL_PATH` | `models/parkinson_model.joblib` (ruta relativa al paquete) | Archivo `.joblib` del clasificador (sklearn u otro bundle con `model` + `features`). |
| `ML_CORS_ORIGINS` | `["http://localhost:5173","http://localhost:8080"]` | Orígenes permitidos CORS; en `.env` suele usarse un JSON en una línea (ver `.env.example`). |

### Whisper (transcripción)

| Variable | Default | Qué considera |
|----------|---------|----------------|
| `ML_WHISPER_MODEL_SIZE` | `base` | Tamaño del modelo OpenAI Whisper (`tiny`, `base`, `small`, `medium`, `large`, …). Más grande → mejor calidad y más RAM/tiempo. |

### Validación de audio (`/v1/audio/validate`)

Estos límites se aplican al **archivo descargado** antes del pipeline de features; no incluyen el paso `noisereduce` (ese solo se aplica en acústico + NLP).

| Variable | Default | Qué considera |
|----------|---------|----------------|
| `ML_AUDIO_MIN_DURATION_SEC` | `1.0` | Duración mínima en segundos. |
| `ML_AUDIO_MAX_DURATION_SEC` | `300.0` | Duración máxima (5 min). Alinear con el frontend/backend si cambias el tope de grabación. |
| `ML_AUDIO_MIN_SAMPLE_RATE` | `8000` | Frecuencia de muestreo mínima (Hz); por debajo se rechaza. |
| `ML_AUDIO_MAX_FILE_SIZE_MB` | `50.0` | Tamaño máximo del fichero en MB. |

### Cadena de audio hacia Praat y Whisper

#### 1) Conversión WebM → WAV (ffmpeg)

Solo aplica cuando el archivo es **`.webm`** (típico del navegador). Otros formatos soportados se leen directamente si el backend puede abrirlos.

| Variable | Default | Qué considera |
|----------|---------|----------------|
| `ML_AUDIO_FFMPEG_AF` | `highpass=f=100` | Filtros **ffmpeg** `-af` aplicados al convertir a WAV mono 48 kHz. Por defecto, **paso alto ~100 Hz** para atenuar rumble de baja frecuencia (ventilación, tráfico lejano). Cadena vacía `""` desactiva filtros extra (solo PCM mono 48 kHz). Puedes ampliar con más filtros si tu versión de ffmpeg lo soporta (probar en entorno de desarrollo). |

#### 2) Reducción espectral (`noisereduce`)

Se aplica **después** de tener un WAV usable, **antes** de extraer features acústicas (Praat) y de transcribir (Whisper). **No** se aplica en la respuesta de validación pura, para no duplicar trabajo en el endpoint de solo chequeo.

| Variable | Default | Qué considera |
|----------|---------|----------------|
| `ML_AUDIO_APPLY_NOISEREDUCE` | `true` | `false` desactiva por completo este paso (útil para comparar señal “casi cruda” tras ffmpeg vs limpia). |
| `ML_AUDIO_NOISEREDUCE_STATIONARY` | `false` | `false` = modelo **no estacionario** (mejor ante **claxon, golpes, picos**). `true` = ruido más **estable** (ventilador, zumbido continuo). |
| `ML_AUDIO_NOISEREDUCE_PROP_DECREASE` | `0.75` | Fracción de reducción aplicada por `noisereduce` (típico rango ~0.5–0.95). **Mayor** → más supresión pero más riesgo de alterar la voz y métricas como jitter/shimmer. Valores ~0.75–0.8 suelen ser un compromiso razonable para tesis. |

**Nota:** Ningún ajuste elimina al 100 % una interferencia muy fuerte; el objetivo es **mejorar la relación señal/ruido** antes del modelo y de las métricas. Si cambias mucho este preprocesado, conviene documentar ablaciones y, si aplica, **reentrenar** el `.joblib` con la misma tubería.

---

## Modelo ML

Coloca tu modelo entrenado en `models/parkinson_model.joblib` (o la ruta definida en `ML_MODEL_PATH`).

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
