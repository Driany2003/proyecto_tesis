#!/usr/bin/env bash
# Prueba rápida del flujo: login → paciente → POST grabación (multipart).
# Requiere backend en marcha (perfil local o dev) y al menos MinIO + BD accesibles.
# Uso: ./scripts/smoke-recording.sh
#      API_BASE=http://localhost:8080/api ./scripts/smoke-recording.sh

set -euo pipefail

API_BASE="${API_BASE:-http://localhost:8080/api}"

echo "Login ($API_BASE/auth/login)..."
HEADERS=$(curl -s -S -D - -o /tmp/smoke_login.json -X POST "${API_BASE%/}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"password"}' || true)

TOKEN=$(echo "$HEADERS" | grep -i '^authorization:' | sed 's/.*[Bb]earer //' | tr -d '\r\n ')

if [[ -z "${TOKEN:-}" ]]; then
  echo "Login falló. Asegúrese de usar perfil dev/local y usuario admin@test.com. Cuerpo:" >&2
  cat /tmp/smoke_login.json >&2 || true
  exit 1
fi

echo "Listando pacientes..."
PATIENTS_JSON=$(curl -s -S "${API_BASE%/}/patients" -H "Authorization: Bearer ${TOKEN}")

PID=$(python3 -c "import json,sys; d=json.loads(sys.stdin.read() or '[]'); print(d[0]['id'] if d else '')" <<< "${PATIENTS_JSON}" || true)

if [[ -z "${PID:-}" ]]; then
  echo "Creando paciente de prueba..."
  CREATED=$(curl -s -S -X POST "${API_BASE%/}/patients" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"fullName":"Paciente smoke","age":70,"gender":"M","dni":"SMOKE01","medicalHistory":"","medication":"","comorbidities":""}')
  PID=$(python3 -c "import json,sys; print(json.load(sys.stdin)['id'])" <<< "${CREATED}")
fi

echo "Subiendo grabación de prueba (paciente ${PID})..."
TMP=$(mktemp /tmp/smokeXXXX.webm)
printf 'fakeaudio' > "${TMP}"

HTTP_BODY=$(curl -s -S -w "\n%{http_code}" -X POST "${API_BASE%/}/patients/${PID}/recordings" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "file=@${TMP};type=audio/webm" \
  -F "durationSeconds=10")
rm -f "${TMP}"

HTTP_CODE=$(echo "${HTTP_BODY}" | tail -n1)
BODY=$(echo "${HTTP_BODY}" | sed '$d')

if [[ "${HTTP_CODE}" != "201" ]]; then
  echo "Error HTTP ${HTTP_CODE}: ${BODY}" >&2
  exit 1
fi

echo "${BODY}" | python3 -m json.tool
SESSION_ID=$(echo "${BODY}" | python3 -c "import json,sys; print(json.load(sys.stdin).get('sessionId',''))")
echo ""
echo "OK: sessionId=${SESSION_ID} (estado processing; n8n debe recibir el webhook si está configurado)."
