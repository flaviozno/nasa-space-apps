"""Outbox enqueueing for observation producers (owner: Matheus).

One OBSERVATIONS event per source record: questionnaire submissions and manual
entry batches share one source_ref across all their rows, while the generic
endpoint emits one event per row. Call inside the producer's transaction so the
data and its event exist or neither does.
"""

from hub_common.sync_contract import ObservationItem, ObservationsPayload
from sqlalchemy.engine import Connection

from app.sync.events import build_observations_event, enqueue_event


def enqueue_observations_event(connection: Connection, crew_id: str, source_ref: str, rows: list[dict]) -> None:
    """Queue one OBSERVATIONS event carrying all rows of a source record.

    `source_ref` must be the record's identity (response id, manual entry ref);
    the deterministic event id makes re-submissions a no-op at the outbox.

    Example: enqueue_observations_event(conn, "crew-1", "resp-uuid", rows).
    """
    event = build_observations_event(
        crew_id,
        source_ref,
        ObservationsPayload(
            source=rows[0]["source"],
            observations=[
                ObservationItem(
                    metric=row["metric"],
                    value=row["value"],
                    unit=row["unit"],
                    taken_at=row["taken_at"],
                )
                for row in rows
            ],
        ),
        rows[0]["created_at"],
    )
    enqueue_event(connection, event)


def enqueue_row_events(connection: Connection, rows: list[dict]) -> None:
    """Queue one OBSERVATIONS event per row (generic endpoint, independent records).

    Rows without a source_ref fall back to their observation id: the event still
    gets a stable identity, so a re-insert attempt re-derives the same event id.
    """
    for row in rows:
        enqueue_observations_event(connection, row["crew_id"], row["source_ref"] or row["id"], [row])
