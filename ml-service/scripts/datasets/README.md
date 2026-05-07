# Datasets de habla conectada para Parkinson

> Esta carpeta contiene los scripts para descargar e integrar datasets
> **públicos** de detección de Parkinson por voz que **sí encajan** con el
> pipeline del sistema (habla conectada: lectura, monólogo, listen-and-repeat),
> a diferencia del dataset clásico de UCI Oxford que solo tiene vocales
> sostenidas /a/.

## Por qué este cambio

El sistema en producción graba **respuestas de pacientes**, no vocales
sostenidas. Entrenar con un dataset de "aaa" (UCI Oxford, Sakar 2019, etc.)
y luego inferir sobre habla conectada es un **task mismatch**: las features
acústicas (jitter, shimmer, HNR) tienen distribuciones distintas entre
ambas tareas, y el modelo "se planta" en la probabilidad base (~0.5) en
producción.

Estos scripts traen corpus que **sí** tienen tareas de habla conectada y
los procesan con el **mismo pipeline** (`app/services/acoustic_service.py`
+ `app/services/nlp_service.py`) que se usa en producción, garantizando que
no haya mismatch de unidades ni preprocesado.

## Datasets soportados

| Script | Corpus | Idioma | Tareas | Acceso | Tamaño |
|---|---|---|---|---|---|
| `italian_parkinson.py` | Italian Parkinson's Voice & Speech (Dimauro 2017) | Italiano | lectura + vocal | **Público** (HuggingFace) | ~565 MB |
| `neurovoz.py` | NeuroVoz (Mendes-Laureano 2024) | Español | monólogo + listen-and-repeat + vocal | **Público con DUA** (Zenodo) | ~1 GB |

## Flujo completo

### 0. Pre-requisitos

```bash
cd ml-service
source .venv/bin/activate
pip install -r requirements.txt   # ahora incluye huggingface_hub
```

Asegúrate de tener PostgreSQL corriendo y las variables de entorno:

```bash
export ML_DB_HOST=localhost
export ML_DB_PORT=5432
export ML_DB_NAME=parkinson_db
export ML_DB_USER=postgres
export ML_DB_PASSWORD=postgres
```

### 1. Migrar el schema (una sola vez)

```bash
psql -h $ML_DB_HOST -U $ML_DB_USER -d $ML_DB_NAME \
     -f scripts/migrations/001_extend_training_samples.sql
```

Esto agrega columnas para `task_type`, `subject_id`, `language`, transcript y
features de NLP (no destruye nada existente).

### 2. Bajar Italian Parkinson (es público y rápido)

```bash
python -m scripts.datasets.italian_parkinson download \
    --out /tmp/italian_parkinson
```

Descarga ~565 MB desde el mirror de Hugging Face del corpus de Dimauro 2017.

### 3. Solicitar acceso a NeuroVoz (lleva 1-3 días)

1. Ir a <https://zenodo.org/records/10777657>
2. Click en **"Request access"**
3. En el "Request message" pegar el DUA del repo + tus datos de tesis
4. Esperar aprobación
5. Bajar el ZIP y descomprimirlo en una carpeta local (ej. `~/Downloads/neurovoz`)

### 4. Inspeccionar antes de ingerir (opcional)

```bash
python -m scripts.datasets.neurovoz info --root ~/Downloads/neurovoz
```

Imprime un resumen como:

```
task                    HC     PD    TOTAL
listen_repeat          880    848    1728
monologue               55     53     108
sustained_vowel        825    795    1620
```

### 5. Ingerir las tareas que SÍ usas en producción

Para tu tesis, lo correcto es ingerir **solo habla conectada**:

```bash
# Italian → solo lectura
python -m scripts.datasets.italian_parkinson ingest \
    --root /tmp/italian_parkinson \
    --tasks reading

# NeuroVoz → monólogo + listen-and-repeat (en español)
python -m scripts.datasets.neurovoz ingest \
    --root ~/Downloads/neurovoz \
    --tasks monologue,listen_repeat
```

**Tip**: el primer run baja el modelo Whisper (~140 MB para `base`). Si quieres
omitir Whisper para una primera prueba rápida (solo features acústicas), añade
`--no-nlp`.

Cada audio se procesa con:
1. ffmpeg (si es .webm) → WAV
2. `noisereduce` (mismo `prop_decrease=0.75` que producción)
3. Praat (parselmouth) → f0_mean, f0_std, jitter, shimmer, hnr, nhr
4. Whisper (`base`, español) → transcripción
5. Métricas NLP → ttr, words_per_min, pause_ratio, filler_count, …

### 6. Verificar la ingesta

```sql
SELECT source, task_type, language,
       COUNT(*) AS n,
       SUM(CASE WHEN label THEN 1 ELSE 0 END) AS pd
  FROM training_samples
 GROUP BY source, task_type, language
 ORDER BY source, task_type;
```

### 7. Reentrenar con el nuevo `train_v2.py`

```bash
# Solo habla conectada (recomendado, alineado con producción):
python scripts/train_v2.py

# Si tienes muy pocos datos conectados, mezcla con vocales:
python scripts/train_v2.py --include-vowels

# Ablación: solo features acústicas, ignorar NLP
python scripts/train_v2.py --no-nlp
```

Diferencias clave vs `train_model.py`:

| Aspecto | v1 (anterior) | v2 (nuevo) |
|---|---|---|
| Validación | `StratifiedKFold` por grabación | `GroupKFold` por **paciente** |
| Features | 5 acústicas | hasta 12 (acústicas + NLP) |
| Tareas | mezcla todo | filtra a habla conectada |
| Umbrales | no calcula | reporta Youden, Sens@90, Spec@95 |

El script imprime al final algo como:

```
>>> RandomForest
    AUC=0.84  Sens=0.79  Spec=0.81  F1=0.80
    youden                  thr=0.412  sens=0.81  spec=0.83
    screening_sens90        thr=0.318  sens=0.91  spec=0.66
    confirmatory_spec95     thr=0.612  sens=0.58  spec=0.96
```

Esos umbrales son los que deberías usar en la pantalla "Umbrales de riesgo":

- `bajo ≤ 31.8%`  → screening_sens90 (descarte con sens≥0.90)
- `alto ≥ 41.2%`  → youden (punto óptimo)
- `crítico 61.2%` → confirmatory_spec95 (alta especificidad)

Y guardas el modelo en `models/parkinson_model.joblib` automáticamente, listo
para que el ml-service lo recargue.

## Próximos datasets a integrar (futuro)

- **MDVR-KCL** (King's College London, inglés, lectura + diálogo, 37 sujetos)
- **PC-GITA** (Orozco-Arroyave, español colombiano, restringido por solicitud)
- **Early Biomarkers / Rusz** (UCI #392, checo, solo features pre-calculadas)
- **mPower** (Sage Bionetworks, miles de sujetos, requiere DAA)

## Referencias

- Dimauro, G. et al. (2017). *Assessment of Speech Intelligibility in
  Parkinson's Disease Using a Speech-To-Text System*. IEEE Access.
  doi: 10.1109/ACCESS.2017.2762475
- Mendes-Laureano, J. et al. (2024). *NeuroVoz: a Castillian Spanish corpus
  of parkinsonian speech*. Scientific Data.
  doi: 10.1038/s41597-024-04186-z
- Rusz, J. et al. (2017). *Early biomarkers of Parkinson's disease based on
  natural connected speech*.
- Orozco-Arroyave, J. R. et al. (2014). *New Spanish speech corpus database
  for the analysis of people suffering from Parkinson's disease* (PC-GITA).
  LREC 2014.
