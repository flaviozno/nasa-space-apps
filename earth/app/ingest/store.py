"""Idempotent storage of event batches from onboard (owner: Guilherme).

A batch is all or nothing: if any event ID already exists with different content,
nothing from the batch is stored and the conflicts are recorded instead.
"""

import hashlib
import json

from hub_common.sync_contract import EventBatch, SyncEvent
from sqlalchemy import Connection, text

INSERT_EVENT_SQL = text(
    """
    INSERT INTO received_events (event_id, type, priority, crew_id, source_ref, payload,
                                 content_sha256, created_at_onboard_ms, received_at_earth_ms,
                                 batch_id)
    VALUES (:event_id, :type, :priority, :crew_id, :source_ref, CAST(:payload AS jsonb),
            :content_sha256, :created_at_onboard_ms, :received_at_earth_ms, :batch_id)
    ON CONFLICT (event_id) DO NOTHING
    """
)


def content_sha256(event: SyncEvent) -> str:
    """Hash of the event's canonical JSON (sorted keys), independent of key order on the wire.

    Example: `content_sha256(event)` → 64 hex characters.
    """
    canonical = json.dumps(event.model_dump(mode="json", by_alias=True), sort_keys=True)
    return hashlib.sha256(canonical.encode()).hexdigest()


def store_batch(connection: Connection, batch: EventBatch, now_ms: int) -> list[str]:
    """Store new events, skip identical duplicates; return conflicting IDs (empty = stored).

    Runs inside the caller's transaction; the caller commits before sending the ACK.
    """
    hashes = {event.event_id: content_sha256(event) for event in batch.events}
    conflicts = _conflicting_ids(connection, hashes)
    if conflicts:
        _record_conflicts(connection, batch.batch_id, conflicts, hashes, now_ms)
        return conflicts
    connection.execute(
        INSERT_EVENT_SQL,
        [
            _event_params(event, hashes[event.event_id], batch.batch_id, now_ms)
            for event in batch.events
        ],
    )
    return []


def _conflicting_ids(connection: Connection, hashes: dict[str, str]) -> list[str]:
    rows = connection.execute(
        text("SELECT event_id, content_sha256 FROM received_events WHERE event_id = ANY(:ids)"),
        {"ids": list(hashes)},
    ).all()
    return sorted(row.event_id for row in rows if row.content_sha256 != hashes[row.event_id])


def _record_conflicts(
    connection: Connection, batch_id: str, conflicts: list[str], hashes: dict[str, str], now_ms: int
) -> None:
    connection.execute(
        text(
            "INSERT INTO event_conflicts (event_id, batch_id, content_sha256, detected_at_ms)"
            " VALUES (:event_id, :batch_id, :content_sha256, :now_ms)"
        ),
        [
            {"event_id": i, "batch_id": batch_id, "content_sha256": hashes[i], "now_ms": now_ms}
            for i in conflicts
        ],
    )


def _event_params(event: SyncEvent, sha256: str, batch_id: str, now_ms: int) -> dict[str, object]:
    return {
        "event_id": event.event_id,
        "type": event.type.value,
        "priority": event.priority,
        "crew_id": event.crew_id,
        "source_ref": event.source_ref,
        "payload": json.dumps(event.payload),
        "content_sha256": sha256,
        "created_at_onboard_ms": event.created_at_onboard_ms,
        "received_at_earth_ms": now_ms,
        "batch_id": batch_id,
    }
