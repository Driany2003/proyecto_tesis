"""Configuración compartida para todos los scripts."""

DB_CONFIG = {
    "host": "5.78.157.191",
    "port": 5432,
    "dbname": "tesis_parkinson",
    "user": "giomar",
    "password": "giomar2003@",
}

MINIO_CONFIG = {
    "endpoint": "5.78.157.191:9000",
    "access_key": "giomar",
    "secret_key": "giomar2003@",
    "secure": False,
    "bucket": "parkinsonvoicesdata",
}

MODEL_OUTPUT_PATH = "../models/parkinson_model.joblib"
EVIDENCE_DIR = "../evidence"
