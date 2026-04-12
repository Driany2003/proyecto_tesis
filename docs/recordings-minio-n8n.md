# Grabaciones: backend, MinIO y n8n

## Flujo

1. El usuario inicia sesión en el frontend y graba desde **Nueva grabación** con un paciente seleccionado.
2. El frontend envía `POST /api/patients/{patientId}/recordings` (multipart: `file`, `durationSeconds`).
3. El backend sube el audio al bucket MinIO (`app-recordings/{patientId}/{recordingId}.ext`).
4. Se guarda un registro en `T_recordings` con `file_path` = clave del objeto y `status` = `processing`.
5. Se genera una **URL prefirmada (GET)** hacia MinIO y se dispara en segundo plano el webhook de n8n con el cuerpo esperado por el workflow (`session_id`, `patient_id`, `audio_uri`, `physician_id`, `clinical`).
6. n8n llama al ml-service (`PARKINSON_API_BASE`) para validar, extraer features, NLP y predicción.

## Variables de configuración (Spring Boot)

En `application.properties` o variables de entorno:

| Propiedad | Ejemplo | Descripción |
|-----------|---------|-------------|
| `app.minio.endpoint` | `http://5.78.157.191:9000` | Endpoint HTTP de MinIO |
| `app.minio.access-key` | (usuario MinIO) | Credencial |
| `app.minio.secret-key` | (secreto) | Credencial |
| `app.minio.bucket` | `parkinsonvoicesdata` | Bucket donde se guardan los audios |
| `app.minio.presign-get-minutes` | `120` | Validez de la URL que recibe n8n/ml-service |
| `app.n8n.webhook-url` | `http://localhost:5678/webhook/parkinson/analyze` | URL completa del webhook; **vacío** = no se llama a n8n (solo MinIO + BD) |

## n8n y ml-service

- El host donde corre **n8n** debe poder:
  - Descargar el audio usando la **URL prefirmada** (salida HTTPS/HTTP a la IP de MinIO).
  - Llamar al **ml-service** en `PARKINSON_API_BASE` (p. ej. `http://IP:8000` o `http://host.docker.internal:8000` si n8n está en Docker y el ml-service en la máquina host).
- Si el workflow tarda mucho (Whisper + Praat), el backend **no espera** la respuesta de n8n: el disparo es **asíncrono** (`@Async`).

## Formato de audio

El navegador suele grabar **WebM** (`recording.webm`). El ml-service acepta `.webm` entre los formatos soportados.

## Producción

No commitear claves reales. Usar secretos del servidor o `SPRING_APPLICATION_JSON` / variables de entorno con el prefijo `APP_MINIO_` según convención Spring Boot relaxed binding (`APP_MINIO_ACCESS_KEY`, etc.).
