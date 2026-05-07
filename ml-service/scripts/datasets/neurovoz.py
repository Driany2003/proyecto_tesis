"""Ingesta del corpus NeuroVoz (Castillian Spanish Parkinsonian Speech).

Mendes-Laureano et al. (2024), Scientific Data.
DOI: 10.5281/zenodo.10777657 — https://zenodo.org/records/10777657

Por qué este dataset es CLAVE para esta tesis:
  - Es el ÚNICO corpus público en castellano de habla parkinsoniana.
  - Incluye monólogos espontáneos (~30 s) y 16 frases listen-and-repeat,
    todas con transcripción manual.
  - 108 sujetos (53 PD + 55 HC), grabaciones .wav a 44.1 kHz.
  - Es el match perfecto con tu pipeline (Praat acústico + Whisper NLP en
    español) y con el caso de uso real (paciente respondiendo, no diciendo /a/).

ACCESO:
  Zenodo requiere un Data Usage Agreement (DUA). Pasos:
    1) Ir a https://zenodo.org/records/10777657
    2) Click en "Request access".
    3) En el "Request message" pegar el DUA del repo + datos personales.
    4) Esperar aprobación (suele tardar 1-3 días).
    5) Bajar el ZIP, descomprimir en una carpeta local.

Estructura esperada después de descomprimir:
  <ROOT>/
    ├── audios/                    # *.wav   (Condition_AudioMaterial[#Rep]_IDPatient.wav)
    ├── transcriptions/            # *.txt   (transcripción manual)
    ├── metadata/
    │   ├── metadata_hc.csv
    │   └── metadata_pd.csv
    ├── audio features/            # solo features de vocales sostenidas
    └── grbas/                     # evaluaciones GRBAS

Convención de nombres de los audios:
  "Condition_AudioMaterial[#Repetition]_IDPatient.wav"
    Condition     = HC | PD
    AudioMaterial = A|E|I|O|U  (vocal sostenida)
                  | <keyword>   (listen-and-repeat, ver Table 3 del paper)
                  | FREE        (monólogo espontáneo)
                  | PATAKA      (DDK)
    Repetition    = 1..3       (solo aplica a vocales)
    IDPatient     = 4 dígitos

Uso:
    # Tras descargar manualmente desde Zenodo:
    python -m scripts.datasets.neurovoz ingest \\
        --root ~/Downloads/neurovoz \\
        --tasks monologue,listen_repeat
"""

from __future__ import annotations

import argparse
import csv
import logging
import os
import re
import sys
from pathlib import Path

from .common import IngestSample, ingest_samples, logger

ZENODO_RECORD_ID = "10777657"
ZENODO_API_RECORD = f"https://zenodo.org/api/records/{ZENODO_RECORD_ID}"

SOURCE_TAG = "neurovoz"
LANGUAGE = "es"

# Sinónimos del nombre real "audios" (Zenodo a veces deja el zip con espacios)
_AUDIO_DIRS = ("audios", "Audios", "AUDIOS")
_META_DIRS = ("metadata", "Metadata", "METADATA")

# AudioMaterial → task_type
_VOWEL_CODES = {"A", "E", "I", "O", "U"}
_DDK_CODES = {"PATAKA"}
_MONOLOGUE_CODES = {"FREE"}
# Cualquier otro string que no sea vocal/DDK/FREE se considera listen-and-repeat
# (16 keywords del paper, no las hardcodeamos para no romper si añaden más).

_FILENAME_RE = re.compile(
    r"^(?P<cond>HC|PD)_"
    r"(?P<material>[A-Za-z]+?)"
    r"(?P<rep>\d+)?"
    r"_(?P<patient>\d{3,5})\.wav$",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# Discovery
# ---------------------------------------------------------------------------


def _classify_material(material: str) -> str | None:
    code = material.upper()
    if code in _VOWEL_CODES:
        return "sustained_vowel"
    if code in _DDK_CODES:
        return None  # DDK no encaja con tu pipeline acústico estándar
    if code in _MONOLOGUE_CODES:
        return "monologue"
    return "listen_repeat"


def _find_audio_dir(root: Path) -> Path:
    for name in _AUDIO_DIRS:
        candidate = root / name
        if candidate.is_dir():
            return candidate
    # quizá descomprimió todo plano
    if any(root.glob("*.wav")):
        return root
    raise FileNotFoundError(
        f"No encontré la carpeta de audios en {root}. "
        f"Esperaba una de: {_AUDIO_DIRS} o .wav directamente en la raíz."
    )


def _load_metadata(root: Path) -> dict[str, dict]:
    """Lee metadata_hc.csv y metadata_pd.csv → {patient_id: {age, sex, ...}}."""
    out: dict[str, dict] = {}
    meta_dir = None
    for name in _META_DIRS:
        cand = root / name
        if cand.is_dir():
            meta_dir = cand
            break
    if meta_dir is None:
        logger.warning("Sin carpeta de metadata; ingesta sin age/sex")
        return out

    for csv_path in meta_dir.glob("metadata_*.csv"):
        try:
            with csv_path.open(encoding="latin-1") as fh:
                reader = csv.DictReader(fh)
                for row in reader:
                    pid = (row.get("ID") or row.get("id") or row.get("Patient") or "").strip().zfill(4)
                    if not pid:
                        continue
                    age_raw = row.get("Age") or row.get("age") or ""
                    sex_raw = (row.get("Sex") or row.get("sex") or row.get("Gender") or "").strip().upper()[:1]
                    out[pid] = {
                        "age": int(age_raw) if age_raw.strip().isdigit() else None,
                        "sex": sex_raw if sex_raw in ("M", "F") else None,
                    }
        except Exception as exc:  # noqa: BLE001
            logger.warning("No pude leer %s: %s", csv_path, exc)
    logger.info("Metadata cargada para %d pacientes", len(out))
    return out


def discover_samples(root: Path, tasks: set[str]) -> list[IngestSample]:
    audio_dir = _find_audio_dir(root)
    metadata = _load_metadata(root)

    samples: list[IngestSample] = []
    skipped_unparseable = 0

    for wav in sorted(audio_dir.glob("*.wav")):
        m = _FILENAME_RE.match(wav.name)
        if not m:
            skipped_unparseable += 1
            continue
        cond = m.group("cond").upper()
        material = m.group("material")
        patient = m.group("patient").zfill(4)

        task = _classify_material(material)
        if task is None or task not in tasks:
            continue

        meta = metadata.get(patient, {})
        samples.append(IngestSample(
            audio_path=wav,
            label=(cond == "PD"),
            subject_id=f"{cond}_{patient}",
            source=SOURCE_TAG,
            task_type=task,
            language=LANGUAGE,
            age=meta.get("age"),
            sex=meta.get("sex"),
        ))

    if skipped_unparseable:
        logger.warning("Saltados %d archivos con nombre no reconocido", skipped_unparseable)
    return samples


# ---------------------------------------------------------------------------
# Descarga (solo con token; el registro es RESTRINGIDO en Zenodo)
# ---------------------------------------------------------------------------


def _zenodo_auth_headers() -> dict[str, str] | None:
    token = (os.environ.get("ZENODO_ACCESS_TOKEN") or "").strip()
    if not token:
        return None
    return {"Authorization": f"Bearer {token}"}


def download_from_zenodo(out_dir: Path) -> int:
    """Descarga los ficheros del registro NeuroVoz usando la API de Zenodo.

    Requisitos:
      - Cuenta en Zenodo con solicitud de acceso **aprobada** para este registro.
      - `ZENODO_ACCESS_TOKEN`: token personal
        (https://zenodo.org/account/settings/applications/).

    Sin token o sin acceso aprobado la API no lista ni sirve los .zip.
    """
    headers = _zenodo_auth_headers()
    if not headers:
        logger.error(
            "NeuroVoz no es descargable en abierto: Zenodo tiene access_right=restricted."
        )
        logger.info(
            "Pasos: (1) Solicita acceso en https://zenodo.org/records/%s",
            ZENODO_RECORD_ID,
        )
        logger.info(
            "(2) Cuando te aprueben, crea un token en "
            "https://zenodo.org/account/settings/applications/"
        )
        logger.info("(3) export ZENODO_ACCESS_TOKEN='...'")
        logger.info(
            "(4) python -m scripts.datasets.neurovoz download --out ~/Downloads/neurovoz"
        )
        return 1

    try:
        import httpx
    except ImportError as exc:
        raise RuntimeError("Instala httpx: pip install httpx") from exc

    out_dir.mkdir(parents=True, exist_ok=True)

    with httpx.Client(timeout=600.0, follow_redirects=True) as client:
        r = client.get(ZENODO_API_RECORD, headers=headers)
        if r.status_code == 401:
            logger.error("Token Zenodo inválido o caducado (401).")
            return 1
        if r.status_code == 403:
            logger.error(
                "403: aún no tienes acceso a este registro. Espera la aprobación del DUA en Zenodo."
            )
            return 1
        r.raise_for_status()
        meta = r.json()

    file_entries: list[dict] = []
    files_block = meta.get("files")
    if isinstance(files_block, list):
        file_entries = files_block
    elif isinstance(files_block, dict) and "entries" in files_block:
        ent = files_block.get("entries") or {}
        if isinstance(ent, dict):
            file_entries = list(ent.values())
        else:
            file_entries = list(ent)

    if not file_entries:
        logger.error(
            "La API no devolvió ficheros. ¿Acceso aprobado y token con permisos de lectura?"
        )
        return 1

    for entry in file_entries:
        key = entry.get("key") or entry.get("filename")
        if not key:
            continue
        links = entry.get("links") or {}
        link = links.get("content") or links.get("self")
        if not link and key:
            link = f"https://zenodo.org/records/{ZENODO_RECORD_ID}/files/{key}?download=1"
        if not link:
            logger.warning("Sin URL de descarga para %s", key)
            continue
        dest = out_dir / key
        if dest.exists() and dest.stat().st_size > 0 and not os.environ.get("ZENODO_REDOWNLOAD"):
            logger.info("Ya existe (omite o usa ZENODO_REDOWNLOAD=1): %s", dest)
            continue
        logger.info("Descargando %s ...", key)
        with httpx.Client(timeout=3600.0, follow_redirects=True) as client:
            with client.stream("GET", link, headers=headers) as resp:
                resp.raise_for_status()
                dest.parent.mkdir(parents=True, exist_ok=True)
                with dest.open("wb") as fh:
                    for chunk in resp.iter_bytes(1024 * 1024):
                        fh.write(chunk)
        logger.info("Guardado: %s", dest)

    logger.info("Listo. Descomprime el .zip y usa: neurovoz ingest --root <carpeta>")
    return 0


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def _cmd_download(args: argparse.Namespace) -> int:
    return download_from_zenodo(Path(args.out).expanduser().resolve())


def _cmd_info(args: argparse.Namespace) -> int:
    """Inspecciona la carpeta sin ingerir nada."""
    root = Path(args.root).expanduser().resolve()
    if not root.exists():
        logger.error("No existe %s", root)
        return 1
    audio_dir = _find_audio_dir(root)
    counts: dict[str, dict[str, int]] = {}
    for wav in audio_dir.glob("*.wav"):
        m = _FILENAME_RE.match(wav.name)
        if not m:
            continue
        cond = m.group("cond").upper()
        task = _classify_material(m.group("material")) or "ddk"
        counts.setdefault(task, {"HC": 0, "PD": 0})
        counts[task][cond] = counts[task].get(cond, 0) + 1
    print(f"\nResumen de {audio_dir}:")
    print(f"{'task':<20} {'HC':>6} {'PD':>6} {'TOTAL':>8}")
    for task, by_cond in sorted(counts.items()):
        hc, pd = by_cond.get("HC", 0), by_cond.get("PD", 0)
        print(f"{task:<20} {hc:>6} {pd:>6} {hc + pd:>8}")
    return 0


def _cmd_ingest(args: argparse.Namespace) -> int:
    root = Path(args.root).expanduser().resolve()
    if not root.exists():
        logger.error("No existe la carpeta: %s", root)
        return 1
    tasks = {t.strip() for t in args.tasks.split(",") if t.strip()}
    samples = discover_samples(root, tasks)
    logger.info("NeuroVoz: %d muestras (tareas=%s)", len(samples), sorted(tasks))
    if not samples:
        logger.warning("Nada para ingestar")
        return 1
    stats = ingest_samples(samples, replace=args.replace, run_nlp=args.nlp)
    logger.info("FIN: %d ok / %d errores", stats.processed, stats.errors)
    if stats.errors and args.verbose:
        for msg in stats.error_msgs[:20]:
            logger.error("  - %s", msg)
    return 0 if stats.errors == 0 else 2


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="NeuroVoz (Castillian Spanish Parkinsonian Speech)")
    sub = p.add_subparsers(dest="cmd", required=True)

    pd = sub.add_parser(
        "download",
        help="Bajar el ZIP desde Zenodo (requiere ZENODO_ACCESS_TOKEN y acceso aprobado)",
    )
    pd.add_argument(
        "--out",
        required=True,
        help="Carpeta donde guardar el fichero (p. ej. ~/Downloads/neurovoz_data)",
    )
    pd.set_defaults(func=_cmd_download)

    pi = sub.add_parser("info", help="Inspeccionar contenidos sin ingerir")
    pi.add_argument("--root", required=True, help="Carpeta raíz descomprimida del ZIP")
    pi.set_defaults(func=_cmd_info)

    pg = sub.add_parser("ingest", help="Procesar audios y poblar training_samples")
    pg.add_argument("--root", required=True, help="Carpeta raíz descomprimida del ZIP")
    pg.add_argument(
        "--tasks", default="monologue,listen_repeat",
        help="Tipos a ingerir, separados por coma. "
             "Opciones: monologue, listen_repeat, sustained_vowel",
    )
    pg.add_argument("--no-nlp", dest="nlp", action="store_false", default=True,
                    help="No correr Whisper (más rápido; solo features acústicas)")
    pg.add_argument("--no-replace", dest="replace", action="store_false", default=True,
                    help="No borrar registros previos de este source antes de insertar")
    pg.add_argument("--verbose", action="store_true")
    pg.set_defaults(func=_cmd_ingest)

    args = p.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
