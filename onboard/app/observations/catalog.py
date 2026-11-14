"""Metric catalog loading for server-side validation (owner: Matheus).

Reads contracts/metrics.json (ONBOARD_METRICS_FILE overrides the path). The
catalog is the single source of truth for metric ids, units, and valid scales:
a value outside its scale is INVALID and the server rejects it instead of
storing a wrong number or a zero.
"""

import json
from functools import cache
from pathlib import Path

from fastapi import HTTPException


@cache
def load_catalog(metrics_file: Path) -> dict:
    """Read contracts/metrics.json, keyed by metric id.

    Example: load_catalog(metrics_file)["heart_rate"]["unit"] == "bpm".
    """
    raw = json.loads(metrics_file.read_text(encoding="utf-8"))
    return {metric["id"]: metric for metric in raw["metrics"]}


def require_metric(catalog: dict, metric_id: str) -> dict:
    """Return the metric definition or raise 404.

    Example: require_metric(catalog, "heart_rate")["unit"] == "bpm".
    """
    metric = catalog.get(metric_id)
    if metric is None:
        raise HTTPException(status_code=404, detail=f"unknown metric: {metric_id}")
    return metric


def validate_value(catalog: dict, metric_id: str, value: float | None) -> None:
    """Reject readings outside the metric scale; None (invalid reading) passes.

    Example: validate_value(catalog, "heart_rate", 500) raises 422.
    """
    if value is None:
        return
    scale = catalog[metric_id].get("scale")
    if scale is not None and not (scale[0] <= value <= scale[1]):
        raise HTTPException(
            status_code=422,
            detail=f"invalid value for {metric_id}: {value} outside scale {scale}",
        )


def metric_label(catalog: dict, metric_id: str) -> str:
    """UI label for the summary endpoint.

    Example: metric_label(catalog, "spo2") == "Blood oxygen (SpO2)".
    """
    return catalog[metric_id].get("label", metric_id)
