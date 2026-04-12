import logging
import sys

def setup_logging(debug: bool = False) -> logging.Logger:
    level = logging.DEBUG if debug else logging.INFO
    fmt = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"

    logging.basicConfig(stream=sys.stdout, level=level, format=fmt, force=True)
    logger = logging.getLogger("ml-service")
    logger.setLevel(level)
    return logger
