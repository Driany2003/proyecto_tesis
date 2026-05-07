"""Re-procesa muestras YA en `training_samples` para llenar las features
extendidas (Camino A) sin re-descargar ni re-ingestar.

Lee cada fila cuyo `extended_features_version` sea NULL o menor a la versión
actual y cuyo `minio_raw_path` apunte a un WAV local accesible. Aplica el
extractor `extract_extended_features` y hace UPDATE.

Idempotente: re-corrérlo solo procesa las filas que falten.

Uso:
    python -m scripts.datasets.recompute_extended         # toda la BD
    python -m scripts.datasets.recompute_extended --source italian_parkinson
    python -m scripts.datasets.recompute_extended --limit 5
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

import psycopg2
import psycopg2.extras

from scripts.datasets.common import _get_db_config, _get_pipeline  # noqa: PLC2701

logger = logging.getLogger("recompute_extended")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")


_SELECT_SQL = """
SELECT id, source, minio_raw_path
FROM training_samples
WHERE minio_raw_path IS NOT NULL
  AND (extended_features_version IS NULL OR extended_features_version < %s)
  {filter_source}
ORDER BY id
{limit_clause};
"""

_UPDATE_SQL = """
UPDATE training_samples SET
    mfcc_means = %(mfcc_means)s,
    mfcc_stds = %(mfcc_stds)s,
    cpp_mean = %(cpp_mean)s,
    dfa = %(dfa)s,
    sample_entropy = %(sample_entropy)s,
    ppe = %(ppe)s,
    rpde = %(rpde)s,
    intensity_mean = %(intensity_mean)s,
    intensity_std = %(intensity_std)s,
    extended_features_version = %(extended_features_version)s
WHERE id = %(id)s;
"""


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Re-procesa training_samples con extended features")
    p.add_argument("--source", help="Filtrar a un source (ej: italian_parkinson)")
    p.add_argument("--limit", type=int, help="Procesar solo N filas (debug)")
    p.add_argument("--audio-prefix", default="",
                   help="Prefijo a quitar del minio_raw_path para resolver el path local")
    p.add_argument("--audio-root",
                   help="Si los WAVs no están en la ruta de minio_raw_path, raíz alternativa donde buscar el archivo por nombre")
    args = p.parse_args(argv)

    from app.services.extended_features_service import EXTENDED_FEATURES_VERSION

    pipeline = _get_pipeline()
    extract_extended = pipeline["extract_extended_features"]
    prepare_audio = pipeline["prepare_audio_file"]
    enhance = pipeline["maybe_enhance_for_ml"]

    conn = psycopg2.connect(**_get_db_config())
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        filter_source = "AND source = %s" if args.source else ""
        limit_clause = "LIMIT %s" if args.limit else ""
        sql = _SELECT_SQL.format(filter_source=filter_source, limit_clause=limit_clause)
        params: list = [EXTENDED_FEATURES_VERSION]
        if args.source:
            params.append(args.source)
        if args.limit:
            params.append(args.limit)
        cur.execute(sql, params)
        rows = cur.fetchall()
        cur.close()
    finally:
        conn.close()

    if not rows:
        logger.info("No hay filas pendientes (extended_features_version >= %d)", EXTENDED_FEATURES_VERSION)
        return 0

    logger.info("Filas a procesar: %d", len(rows))

    ok, skipped, errors = 0, 0, 0
    for i, row in enumerate(rows, 1):
        sample_id = row["id"]
        raw_path = Path(row["minio_raw_path"])

        # 1) intentar el path tal cual está
        local_path = raw_path
        if not local_path.exists() and args.audio_root:
            # 2) buscar por nombre dentro de --audio-root
            candidates = list(Path(args.audio_root).rglob(raw_path.name))
            if candidates:
                local_path = candidates[0]

        if not local_path.exists():
            logger.warning("[%d/%d] id=%d source=%s: WAV no encontrado (%s)",
                           i, len(rows), sample_id, row["source"], raw_path)
            skipped += 1
            continue

        try:
            work_path, paths_to_delete = prepare_audio(local_path)
            work_path, extra = enhance(work_path)
            paths_to_delete.extend(extra)

            ext = extract_extended(work_path)
            update_dict = ext.to_db_dict()
            update_dict["id"] = sample_id

            conn = psycopg2.connect(**_get_db_config())
            try:
                with conn:
                    with conn.cursor() as upcur:
                        upcur.execute(_UPDATE_SQL, update_dict)
            finally:
                conn.close()

            for ptd in paths_to_delete:
                if ptd != local_path and ptd.exists():
                    try:
                        ptd.unlink()
                    except OSError:
                        pass

            ok += 1
            logger.info("[%d/%d] id=%d %s OK", i, len(rows), sample_id, local_path.name)
        except Exception as exc:  # noqa: BLE001
            errors += 1
            logger.error("[%d/%d] id=%d %s ERROR: %s",
                         i, len(rows), sample_id, local_path.name, exc)

    logger.info("Resumen: %d ok, %d sin audio, %d errores", ok, skipped, errors)
    return 0 if errors == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
