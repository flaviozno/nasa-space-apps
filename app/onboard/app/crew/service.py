"""Crew API read-side calculations (owner: Matheus).

Pure functions over repository rows and the frozen contracts: the per-metric
summary (latest value, z-score against the fixed baseline, status) and the
trend downsampling for the hub charts. No I/O here — the router supplies data.

Status rules (readme.md section 8; ALERT_Z in contracts/tests):
- NO_DATA: no observation for the metric yet — never shown as zero.
- INVALID: the latest observation stored a null value (invalid reading).
- DEVIATION: |z| >= 3 against the crew member's baseline.
- STALE: the latest value is older than the freshness window of its source
  (wearable 5 min, manual/questionnaire 26 h). Stale downgrades OK only — a
  real deviation stays DEVIATION so alerts are never hidden by staleness.
- OK: everything else.
"""

from app.crew.schemas import (
    CrewSummaryOut,
    MetricSummaryOut,
    MetricTrendOut,
    ObservationStatus,
    TrendPointOut,
)

# z threshold agreed in contracts (ALERT_Z in contracts/tests/test_crew_baseline.py).
ALERT_Z = 3.0
# Freshness window per source kind, in ms. Acquisition is minute-batched, so a
# wearable reading older than 5 minutes is stale; manual/questionnaire input is
# daily, so 26 h covers "yesterday's entry is no longer today".
STALE_AFTER_MS = {"wearable": 5 * 60_000, "manual": 26 * 3_600_000, "questionnaire": 26 * 3_600_000}


def summarize(contract: dict, catalog: dict, member: dict, latest: dict, now_ms: int) -> CrewSummaryOut:
    """Build the per-metric summary for one crew member.

    `latest` maps metric id -> the newest observation row (repository.latest_per_metric).
    Metrics follow the contract order so the hub renders the same list every time.

    Example: summarize(crew, metrics, member, {}, now) -> every metric NO_DATA.
    """
    metrics: list[MetricSummaryOut] = []
    for metric_id, definition in contract["metrics"].items():
        row = latest.get(metric_id)
        value = z_score = taken_at = None
        status = ObservationStatus.no_data
        if row is not None:
            value = row["value"]
            taken_at = row["taken_at"]
            if value is None:
                status = ObservationStatus.invalid
            else:
                baseline = member["baselines"][metric_id]
                z_score = round((value - baseline["median"]) / baseline["spread"], 2)
                status = ObservationStatus.deviation if abs(z_score) >= ALERT_Z else ObservationStatus.ok
                if _is_stale(definition["source"], taken_at, now_ms) and status is ObservationStatus.ok:
                    status = ObservationStatus.stale
        metrics.append(
            MetricSummaryOut(
                metric=metric_id,
                label=catalog[metric_id]["label"],
                unit=definition["unit"],
                value=value,
                taken_at=taken_at,
                z_score=z_score,
                status=status,
            )
        )
    return CrewSummaryOut(crew_id=member["crewId"], generated_at=now_ms, metrics=metrics)


def _is_stale(source: str, taken_at: int, now_ms: int) -> bool:
    return now_ms - taken_at > STALE_AFTER_MS.get(source, 26 * 3_600_000)


def trend_for(contract: dict, catalog: dict, member: dict, metric_id: str, rows: list, max_points: int) -> MetricTrendOut:
    """Downsample the window rows to at most max_points, oldest first.

    Keeps every nth point (stride rounding up) so charts get an even spread of
    the window instead of only its beginning.

    Example: trend_for(..., rows=[10 points], max_points=4).points has 4 points.
    """
    unit = contract["metrics"][metric_id]["unit"]
    points: list[TrendPointOut] = []
    if rows:
        stride = max(1, -(-len(rows) // max_points))
        picked = rows[::stride]
        # The newest point is always kept so the chart ends at "now".
        if picked[-1]["id"] != rows[-1]["id"]:
            picked.append(rows[-1])
        points = [TrendPointOut(taken_at=row["taken_at"], value=row["value"]) for row in picked]
    return MetricTrendOut(crew_id=member["crewId"], metric=metric_id, unit=unit, points=points)
