# Sistema de apoyo al diagnóstico - Parkinson

Proyecto con **Frontend** (React + TypeScript) y **Backend** (Java 17, Spring Boot) para captura de voz, análisis y evaluación de riesgo de Parkinson.

## Estructura

- **Frontend/**: aplicación React (Vite), login, pacientes, grabaciones, auditoría, respaldos, umbrales de riesgo.
- **backend/**: API REST en Java 17 (Spring Boot 3), JWT, JPA, H2 (dev) / PostgreSQL (prod).

## Cómo correr

### Stack local (PostgreSQL + MinIO + n8n con Docker)

En la raíz del repositorio:

```bash
docker compose up -d
```

- PostgreSQL: `localhost:5432`, base `tesis_parkinson`, usuario `parkinson` / contraseña `parkinson_local`.
- MinIO: API `http://127.0.0.1:9000`, consola `http://127.0.0.1:9001`, usuario `minioadmin` / `minioadmin`, bucket `parkinsonvoicesdata` (creado por el contenedor `minio-init`).
- n8n: [http://localhost:5678](http://localhost:5678). Importa y activa tu workflow con el webhook `http://localhost:5678/webhook/parkinson/analyze`.

Luego arranca el backend con el perfil **`local`** (usa `application-local.properties` y los datos anteriores):

```bash
cd backend
./mvnw spring-boot:run -Dspring-boot.run.profiles=local
```

Si el puerto `5432` ya está ocupado por otro PostgreSQL, detén ese servicio o cambia el mapeo de puertos en `docker-compose.yml`.

### Backend

```bash
cd backend
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
```

API en [http://localhost:8080/api](http://localhost:8080/api). Usuario de prueba (perfiles `dev` y `local`): **admin@test.com** / **password**.

### Frontend

```bash
cd Frontend
npm install
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173). El proxy de Vite envía `/api` al backend en `localhost:8080`. Opcional: `VITE_API_BASE_URL` en `Frontend/.env` (ver `Frontend/.env.example`).

### Comprobar el flujo de grabación (CLI)

Con el backend en marcha (`dev` o `local`):

```bash
./scripts/smoke-recording.sh
```

Debe devolver JSON con `sessionId` y estado `processing`. Si n8n está activo y `app.n8n.webhook-url` apunta al webhook correcto, el workflow recibirá el POST en segundo plano.

## Usuarios de prueba

| Origen   | Correo          | Contraseña | Rol          |
|----------|-----------------|------------|--------------|
| Backend (dev) | admin@test.com | password   | ADMIN        |
| Demo (mocks)  | admin@demo.com | demo123    | Administrador |

## Migración de base de datos

Si la tabla `T_users` (o `users` si aún no usas el prefijo T_) tiene columnas antiguas y el backend falla al arrancar (por ejemplo *null value in column "password_hash"* o *"role"*), ejecuta en PostgreSQL una sola vez (usando el nombre real de tu tabla):

```sql
ALTER TABLE T_users DROP COLUMN IF EXISTS password_hash;
ALTER TABLE T_users DROP COLUMN IF EXISTS role;
```

Script completo en `backend/src/main/resources/db/migration/V1__drop_users_password_hash.sql`.

## Variables de entorno

- **Frontend**: `VITE_API_URL` — URL base del API. Ver `Frontend/.env.example`.
- **Backend (producción)**: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`. Ver `backend/env.prod.example` y `application-prod.properties`.
