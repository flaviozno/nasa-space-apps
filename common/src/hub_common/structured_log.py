"""One-line JSON log records for debugging and observability."""

import json
import logging

from pydantic import JsonValue


def configure_service_logging(service_name: str) -> None:
    """Send this service's INFO logs (logger names starting with `service_name`) to stderr.

    Uvicorn only configures its own loggers; without this, app INFO records are dropped.

    Example: `configure_service_logging("onboard")` makes `onboard.sync.worker` visible.
    """
    service_logger = logging.getLogger(service_name)
    service_logger.setLevel(logging.INFO)
    if not service_logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("%(levelname)s %(name)s %(message)s"))
        service_logger.addHandler(handler)


def log_json(logger: logging.Logger, level: int, event: str, **fields: JsonValue) -> None:
    """Log `{"event": ..., **fields}` as a single JSON line. Never pass tokens or health payloads.

    Example: `log_json(logger, logging.INFO, "batch_synced", batch_id="b-1", events=3)`
    """
    logger.log(level, json.dumps({"event": event, **fields}, sort_keys=True))
