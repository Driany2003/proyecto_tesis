"""Descarga e ingesta del corpus Italian Parkinson's Voice and Speech.

Corpus de Dimauro et al. (2017), DOI 10.21227/aw6b-tg17, distribuido bajo
licencia abierta en IEEE DataPort (565 MB) y mirrored en Hugging Face
(`birgermoell/Italian_Parkinsons_Voice_and_Speech`).

Justificación de uso para esta tesis:
  - Contiene tareas de LECTURA (`PR1*.wav`, `PR2*.wav`) además de vocales
    sostenidas (`B1*.wav`, `B2*.wav`).
  - Las grabaciones de lectura son habla conectada → compatibles con el
    pipeline acústico + NLP que corre en producción (no como UCI Oxford,
    que es solo /a/ sostenida).
  - 65 sujetos: 28 PD + 22 controles mayores + 15 controles jóvenes.

Estructura esperada en disco después de bajar:
  <DATA_DIR>/italian_parkinson/
    ├── 28 People with Parkinson's disease/
    │   └── <subject_xxx>/
    │       ├── B1*.wav   (vocal sostenida)
    │       ├── B2*.wav   (vocal sostenida)
    │       └── PR1*.wav  (lectura) [+ PR1*.txt = transcripción de referencia]
    ├── 22 Elderly Healthy Control/
    └── 15 Young Healthy Control/

Uso:
    # 1) Bajar (requiere ~600 MB en disco)
    python -m scripts.datasets.italian_parkinson download \\
        --out /tmp/italian_parkinson

    # 2) Ingerir SOLO las tareas de habla conectada (recomendado para la tesis)
    python -m scripts.datasets.italian_parkinson ingest \\
        --root /tmp/italian_parkinson \\
        --tasks reading

    # 2-bis) O ingerir todo (vocales + lectura) si quieres comparar
    python -m scripts.datasets.italian_parkinson ingest \\
        --root /tmp/italian_parkinson \\
        --tasks reading,sustained_vowel
"""

from __future__ import annotations

import argparse
import logging
import re
import sys
from pathlib import Path

from .common import IngestSample, ingest_samples, logger

SOURCE_TAG = "italian_parkinson"
LANGUAGE = "it"

# Hugging Face mirror (más fácil de bajar programáticamente que IEEE DataPort)
HF_REPO = "birgermoell/Italian_Parkinsons_Voice_and_Speech"


# ---------------------------------------------------------------------------
# Descarga
# ---------------------------------------------------------------------------


def download(out_dir: Path) -> Path:
    """Descarga el dataset desde Hugging Face a `out_dir`.

    El mirror de HF incluye DOS copias del corpus:
      a) los ~840 archivos sueltos (.wav, .txt, .xlsx)  ← lo que queremos
      b) el ZIP original "Italian Parkinson's Voice and speech.zip"  ← duplicado

    Filtramos (b) con `ignore_patterns` para no bajar 565 MB redundantes.
    """
    try:
        from huggingface_hub import snapshot_download
    except ImportError as exc:
        raise RuntimeError(
            "Falta `huggingface_hub`. Instala: pip install huggingface_hub"
        ) from exc

    out_dir.mkdir(parents=True, exist_ok=True)
    logger.info("Descargando %s -> %s (~565 MB, puede tomar varios minutos)", HF_REPO, out_dir)
    snapshot_download(
        repo_id=HF_REPO,
        repo_type="dataset",
        local_dir=str(out_dir),
        local_dir_use_symlinks=False,
        # Evitar el ZIP duplicado y ficheros administrativos pesados
        ignore_patterns=[
            "*.zip",
            "*.ZIP",
            ".gitattributes",
        ],
    )
    logger.info("Descarga completa")
    return out_dir


# ---------------------------------------------------------------------------
# Discovery: clasificar archivos a (label, task_type, subject_id)
# ---------------------------------------------------------------------------


# Convención de nombres del corpus (ver paper Dimauro et al. 2017):
#   VA*, VE*, VI*, VO*, VU*  → vocali sostenute (5 vocales sostenidas)
#   B1*, B2*                 → parole Bisillabiche (palabras bisílabas aisladas)
#   D1*, D2*                 → Diadococinesi (pa-ta-ka, ko-go-go, etc.)
#   PR*                      → Parlato di Riferimento (lectura del pasaje)
#   FB*                      → discurso espontáneo / monólogo libre
_TASK_RE = re.compile(r"^(V[AEIOU]|B[12]|D[12]|PR|FB)", re.IGNORECASE)


def _classify_task(filename: str) -> str | None:
    m = _TASK_RE.match(filename)
    if not m:
        return None
    code = m.group(1).upper()
    if code.startswith("V"):
        return "sustained_vowel"
    if code.startswith(("B", "D")):
        # Palabras bisílabas / diadococinesias: habla conectada cortita,
        # útiles para entrenamiento aunque más cortas que un párrafo de lectura.
        return "isolated_word"
    if code.startswith("PR"):
        return "reading"
    if code.startswith("FB"):
        return "monologue"
    return None


# Identificadores de los 3 grupos en el corpus (carpetas top-level)
_GROUPS = (
    ("parkinson",                          (True,  "PD")),
    ("elderly",                            (False, "HC_elderly")),
    ("young",                              (False, "HC_young")),
)


def _find_group_for(wav: Path, root: Path) -> tuple[bool, str] | None:
    """Camina desde el wav hasta `root` buscando una carpeta de grupo.

    Esto soporta tanto la estructura plana (HC: <root>/<grupo>/<sujeto>/<wav>)
    como la estructura con sub-carpetas numéricas
    (PD: <root>/<grupo>/<rango>/<sujeto>/<wav>).
    """
    current = wav.parent
    while current != root and current != current.parent:
        name = current.name.lower()
        for needle, result in _GROUPS:
            if needle in name:
                return result
        current = current.parent
    return None


def _subject_dir_for(wav: Path, root: Path) -> Path:
    """Devuelve la carpeta del sujeto: la primera carpeta arriba del wav
    que NO es de grupo ni un rango numérico tipo "11-16"."""
    range_re = re.compile(r"^\d+-\d+$")
    current = wav.parent
    while current != root and current != current.parent:
        name_lower = current.name.lower()
        is_group = any(needle in name_lower for needle, _ in _GROUPS)
        is_range = bool(range_re.match(current.name))
        if not is_group and not is_range:
            return current
        current = current.parent
    return wav.parent


def discover_samples(root: Path, tasks: set[str]) -> list[IngestSample]:
    """Recorre `root` y construye la lista de muestras a ingestar."""
    samples: list[IngestSample] = []
    skipped_no_group = 0
    for wav in sorted(root.rglob("*.wav")):
        task = _classify_task(wav.name)
        if task is None or task not in tasks:
            continue

        cls = _find_group_for(wav, root)
        if cls is None:
            skipped_no_group += 1
            logger.debug("Sin grupo para: %s", wav)
            continue
        label_pd, group_tag = cls

        subject_dir = _subject_dir_for(wav, root)
        subject_id = f"{group_tag}_{subject_dir.name}"

        samples.append(IngestSample(
            audio_path=wav,
            label=label_pd,
            subject_id=subject_id,
            source=SOURCE_TAG,
            task_type=task,
            language=LANGUAGE,
        ))
    if skipped_no_group:
        logger.warning("Saltados %d archivos sin grupo identificable", skipped_no_group)
    return samples


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def _cmd_download(args: argparse.Namespace) -> int:
    out = Path(args.out).expanduser().resolve()
    download(out)
    return 0


def _cmd_ingest(args: argparse.Namespace) -> int:
    root = Path(args.root).expanduser().resolve()
    if not root.exists():
        logger.error("No existe la carpeta: %s", root)
        return 1
    tasks = {t.strip() for t in args.tasks.split(",") if t.strip()}
    samples = discover_samples(root, tasks)
    logger.info("Encontradas %d muestras (%s)", len(samples), sorted(tasks))
    if not samples:
        logger.warning("Nada para ingestar — verifica la estructura del directorio")
        return 1
    stats = ingest_samples(samples, replace=args.replace, run_nlp=args.nlp)
    logger.info("FIN: %d ok / %d errores", stats.processed, stats.errors)
    if stats.errors and args.verbose:
        for msg in stats.error_msgs[:20]:
            logger.error("  - %s", msg)
    return 0 if stats.errors == 0 else 2


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Italian Parkinson Voice & Speech corpus")
    sub = p.add_subparsers(dest="cmd", required=True)

    pd = sub.add_parser("download", help="Bajar el dataset desde Hugging Face")
    pd.add_argument("--out", required=True, help="Carpeta destino")
    pd.set_defaults(func=_cmd_download)

    pi = sub.add_parser("ingest", help="Procesar audios y poblar training_samples")
    pi.add_argument("--root", required=True, help="Carpeta raíz del dataset descargado")
    pi.add_argument("--tasks", default="reading",
                    help="Tipos a ingerir, separados por coma. Opciones: reading,sustained_vowel")
    pi.add_argument("--no-nlp", dest="nlp", action="store_false", default=True,
                    help="No correr Whisper (más rápido; solo features acústicas)")
    pi.add_argument("--no-replace", dest="replace", action="store_false", default=True,
                    help="No borrar registros previos de este source antes de insertar")
    pi.add_argument("--verbose", action="store_true")
    pi.set_defaults(func=_cmd_ingest)

    args = p.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
