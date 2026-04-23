"""Configuración compartida para todos los scripts.

Las credenciales se leen de variables de entorno; nunca se hardcodean en código
versionado. Define `ML_DB_*` y `ML_MINIO_*` (o las equivalentes legacy) en tu
`.env` o entorno de ejecución antes de invocar los scripts.
"""

from __future__ import annotations

import os
from pathlib import Path


def _required_env(*names: str) -> str:
    """Devuelve el primer valor no vacío entre las variables indicadas o lanza."""
    for name in names:
        value = os.environ.get(name)
        if value:
            return value
    raise RuntimeError(
        "Variable de entorno requerida no configurada (intenta una de): "
        + ", ".join(names)
    )


def _optional_env(*names: str, default: str = "") -> str:
    for name in names:
        value = os.environ.get(name)
        if value:
            return value
    return default


DB_CONFIG = {
    "host": _required_env("ML_DB_HOST", "DB_HOST"),
    "port": int(_optional_env("ML_DB_PORT", "DB_PORT", default="5432")),
    "dbname": _required_env("ML_DB_NAME", "DB_NAME"),
    "user": _required_env("ML_DB_USER", "DB_USER"),
    "password": _required_env("ML_DB_PASSWORD", "DB_PASSWORD"),
}

MINIO_CONFIG = {
    "endpoint": _required_env("ML_MINIO_ENDPOINT", "MINIO_ENDPOINT"),
    "access_key": _required_env("ML_MINIO_ACCESS_KEY", "MINIO_ACCESS_KEY"),
    "secret_key": _required_env("ML_MINIO_SECRET_KEY", "MINIO_SECRET_KEY"),
    "secure": _optional_env("ML_MINIO_SECURE", "MINIO_SECURE", default="false").lower()
    in {"1", "true", "yes"},
    "bucket": _optional_env(
        "ML_MINIO_BUCKET", "MINIO_BUCKET", default="parkinsonvoicesdata"
    ),
}

_SCRIPTS_DIR = Path(__file__).resolve().parent

MODEL_OUTPUT_PATH = os.environ.get(
    "ML_MODEL_OUTPUT_PATH",
    str(_SCRIPTS_DIR.parent / "models" / "parkinson_model.joblib"),
)
EVIDENCE_DIR = os.environ.get(
    "ML_EVIDENCE_DIR", str(_SCRIPTS_DIR.parent / "evidence")
)
