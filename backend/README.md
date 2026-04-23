# Backend Parkinson (Spring Boot)

API REST con prefijo de contexto **`/api`** (puerto interno por defecto **8080**).

## Requisitos en el servidor

- **Java 17** (`apt install openjdk-17-jre-headless` o equivalente)
- **PostgreSQL** accesible desde el host
- **MinIO** y **n8n** si usas el flujo completo de grabaciones (configurable por variables)

---

## 1. Compilar el JAR

En tu máquina de desarrollo o en CI:

```bash
cd backend
mvn -q package -DskipTests
```

El artefacto queda en:

`target/backend-1.0.0-SNAPSHOT.jar`

---

## 2. Instalar en `/opt`

Convención recomendada:

| Ruta | Contenido |
|------|-----------|
| `/opt/parkinson-backend/` | Directorio de la aplicación |
| `/opt/parkinson-backend/backend.jar` | JAR ejecutable (nombre fijo para el servicio systemd) |
| `/etc/parkinson-backend.env` | Variables de entorno (permisos `640`, propietario `root`, grupo de servicio) |

Ejemplo (como root o con `sudo`):

```bash
sudo mkdir -p /opt/parkinson-backend
sudo cp target/backend-1.0.0-SNAPSHOT.jar /opt/parkinson-backend/backend.jar
sudo chown -R root:root /opt/parkinson-backend
```

---

## 3. Variables de entorno (producción)

No subas secretos al repositorio. Crea `/etc/parkinson-backend.env` con valores reales, por ejemplo:

```bash
# Perfil
SPRING_PROFILES_ACTIVE=prod

# Servidor (opcional: solo si quieres otro puerto)
SERVER_PORT=8080

# Base de datos
SPRING_DATASOURCE_URL=jdbc:postgresql://127.0.0.1:5432/tesis_parkinson
SPRING_DATASOURCE_USERNAME=tu_usuario
SPRING_DATASOURCE_PASSWORD=tu_password

# JWT (mínimo ~32 caracteres en producción)
JWT_SECRET=cambia-esto-por-un-secreto-largo-y-aleatorio
JWT_EXPIRATION_MS=86400000

# CORS: orígenes del frontend (HTTPS), separados por coma
APP_CORS_ALLOWED_ORIGINS=https://tu-dominio.com

# MinIO / n8n / webhook (según tu despliegue)
APP_MINIO_ENDPOINT=http://127.0.0.1:9000
APP_MINIO_ACCESS_KEY=...
APP_MINIO_SECRET_KEY=...
APP_MINIO_BUCKET=parkinsonvoicesdata
APP_N8N_WEBHOOK_URL=https://tu-n8n/webhook/parkinson/analyze
APP_WEBHOOK_RECORDING_SECRET=un-secreto-compartido-con-n8n

# DDL: en producción suele usarse validate o none tras migraciones
SPRING_JPA_HIBERNATE_DDL_AUTO=validate
```

Spring Boot mapea propiedades con `APP_` para `app.*` si usas configuración relajada; si alguna variable no se aplica, usa el nombre exacto del `application.properties` en formato ENV (por ejemplo `APP_CORS_ALLOWED_ORIGINS` para `app.cors.allowed-origins`). Ver [documentación](https://docs.spring.io/spring-boot/reference/features/external-config.html).

**Importante:** el `application.properties` del repo puede contener valores de desarrollo; en producción **sobrescribe** con este archivo o con variables de entorno para no dejar contraseñas por defecto.

---

## 4. Servicio systemd

Crea `/etc/systemd/system/parkinson-backend.service`:

```ini
[Unit]
Description=Parkinson Backend API (Spring Boot)
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/parkinson-backend
EnvironmentFile=/etc/parkinson-backend.env
ExecStart=/usr/bin/java -jar /opt/parkinson-backend/backend.jar
Restart=on-failure
RestartSec=10
# Límite de archivos (subidas multipart)
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```

Ajusta `User`/`Group` (p. ej. `parkinson` dedicado). Luego:

```bash
sudo systemctl daemon-reload
sudo systemctl enable parkinson-backend
sudo systemctl start parkinson-backend
sudo systemctl status parkinson-backend
```

Logs:

```bash
sudo journalctl -u parkinson-backend -f
```

---

## 5. Nginx como proxy inverso

La aplicación expone rutas bajo **`/api`** (por ejemplo `http://127.0.0.1:8080/api/auth/login`).

Ejemplo **HTTP** (solo red interna o pruebas; en Internet usa **HTTPS** con Let’s Encrypt):

```nginx
# /etc/nginx/sites-available/parkinson-api
server {
    listen 80;
    server_name api.tu-dominio.com;

    client_max_body_size 55M;

    location /api {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
}
```

Habilitar sitio y recargar:

```bash
sudo ln -s /etc/nginx/sites-available/parkinson-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

**HTTPS:** usa `certbot` o certificados propios y deja el mismo `location /api` en el bloque `listen 443 ssl`.

**Frontend:** el navegador suele llamar a la misma URL (`https://tu-dominio.com`) con `/api` enrutado por Nginx; configura el Vite/`VITE_API_BASE_URL` en el build del frontend para que apunte a **`/api`** (mismo origen) o a `https://api.tu-dominio.com/api` según tu diseño.

---

## 6. Comprobación rápida

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8080/api/
```

(O un `GET`/`POST` concreto que tengas documentado, p. ej. login.) Código `401`/`403` en rutas protegidas indica que el servicio responde.

---

## 7. Firewall

Abre solo lo necesario:

- **Nginx:** 80/443 (público)
- **Backend 8080:** solo `127.0.0.1` (no exponer a Internet si Nginx hace de proxy)

```bash
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## Resumen de puertos

| Servicio | Puerto típico | Quién accede |
|----------|-----------------|--------------|
| Spring Boot | 8080 | Solo localhost → Nginx |
| Nginx | 80 / 443 | Clientes |

---

## Desarrollo local

```bash
mvn spring-boot:run
```

Perfil por defecto en el repo: `dev` (ver `application.properties`). Para producción local de prueba: `SPRING_PROFILES_ACTIVE=prod` y variables en `.env` o export.
