"""Fixture data for the observation endpoints (Phase 0.4 stubs).

`GET /v1/observations` answers a deterministic recent-history list for the
emulator-generated metrics, and `POST /v1/observations` echoes the batch back
with server-resolved units and ids, like the real endpoint will.
"""

from app.crew.fixtures import now_ms, stable_id
from app.observations.schemas import (
    ObservationBatchIn,
    ObservationBatchOut,
    ObservationOut,
    ObservationSource,
)

# Ordered so fixtures look like real ingest: heart rate, SpO2, temperature.
FIXTURE_SEQUENCE = ("heart_rate", "spo2", "body_temp")
FIXTURE_INTERVAL_MS = 60_000


def sample_observations(contract: dict, crew_id: str, limit: int) -> list[ObservationOut]:
    """Recent wearable observations for one member, oldest first.

    Example: sample_observations(contract, "crew-1", 3)[0].metric == "heart_rate".
    """
    member = next(item for item in contract["crew"] if item["crewId"] == crew_id)
    units = contract["metrics"]
    reference = now_ms() - limit * FIXTURE_INTERVAL_MS
    rows = []
    for index in range(limit):
        metric_id = FIXTURE_SEQUENCE[index % len(FIXTURE_SEQUENCE)]
        baseline = member["baselines"][metric_id]
        rows.append(
            ObservationOut(
                id=stable_id("obs", crew_id, metric_id, index),
                crew_id=crew_id,
                metric=metric_id,
                value=round(baseline["median"] * 1.01, 2),
                unit=units[metric_id]["unit"],
                source=ObservationSource.wearable,
                source_ref=f"emu-{crew_id}-{index:04d}",
                taken_at=reference + index * FIXTURE_INTERVAL_MS,
            )
        )
    return rows


def accept_batch(batch: ObservationBatchIn, contract: dict) -> ObservationBatchOut:
    """Echo the batch with server-resolved units and deterministic ids (stub behavior)."""
    units = contract["metrics"]
    timestamp = now_ms()
    accepted = [
        ObservationOut(
            id=stable_id("obs", item.crew_id, item.metric, item.source_ref or str(index)),
            crew_id=item.crew_id,
            metric=item.metric,
            value=item.value,
            unit=units[item.metric]["unit"],
            source=item.source,
            source_ref=item.source_ref,
            taken_at=item.taken_at if item.taken_at is not None else timestamp,
        )
        for index, item in enumerate(batch.observations)
    ]
    return ObservationBatchOut(accepted=accepted, duplicates=0)
