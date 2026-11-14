"""How producers (ingest, Crew API) hand events to the Outbox.

`enqueue_event` is the only way into the outbox. Call it with the same connection
(transaction) that writes the source data, so both exist or neither does.
"""

import json
import uuid

from hub_common.sync_contract import PRIORITY_BY_TYPE, EventType, SyncEvent
from pydantic import JsonValue
from sqlalchemy import Connection, text

# Fixed namespace: the same (type, source_ref) always yields the same event_id.
EVENT_ID_NAMESPACE = uuid.UUID("6f1d3c52-2b7e-4f0a-9a43-5e8c1b7d2a90")

INSERT_SQL = text(
    """
    INSERT INTO outbox (event_id, type, priority, crew_id, source_ref, payload,
                        created_at_onboard_ms, next_attempt_at_ms)
    VALUES (:event_id, :type, :priority, :crew_id, :source_ref, CAST(:payload AS jsonb),
            :created_at_onboard_ms, :created_at_onboard_ms)
    ON CONFLICT (event_id) DO NOTHING
    RETURNING event_id
    """
)


def build_event(
    event_type: EventType,
    crew_id: str,
    source_ref: str,
    payload: dict[str, JsonValue],
    created_at_onboard_ms: int,
) -> SyncEvent:
    """Build an event whose ID is derived from (type, source_ref).

    `source_ref` must identify the content (sample ID, response ID, alert ID): enqueueing
    the same source twice then creates one event, not two.

    Example:
        build_event(EventType.ALERT, "crew-3", "alert-42", {"metric": "spo2"}, now_ms)
    """
    event_id = uuid.uuid5(EVENT_ID_NAMESPACE, f"{event_type.value}:{source_ref}")
    return SyncEvent(
        event_id=f"evt-{event_id.hex}",
        type=event_type,
        priority=PRIORITY_BY_TYPE[event_type],
        crew_id=crew_id,
        source_ref=source_ref,
        created_at_onboard_ms=created_at_onboard_ms,
        payload=payload,
    )


def enqueue_event(connection: Connection, event: SyncEvent) -> bool:
    """Insert the event as PENDING inside the caller's transaction; False if already queued.

    Example (inside the producer's transaction):
        enqueue_event(connection, build_event(EventType.OBSERVATIONS, ...))
    """
    row = connection.execute(INSERT_SQL, _insert_params(event)).first()
    return row is not None


def _insert_params(event: SyncEvent) -> dict[str, object]:
    return {
        "event_id": event.event_id,
        "type": event.type.value,
        "priority": event.priority,
        "crew_id": event.crew_id,
        "source_ref": event.source_ref,
        "payload": json.dumps(event.payload),
        "created_at_onboard_ms": event.created_at_onboard_ms,
    }
