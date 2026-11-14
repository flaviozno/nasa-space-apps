"""PostgreSQL access for the Outbox worker and the sync endpoints.

Each method runs in its own short transaction. Producers do not use this class:
they call app.sync.events.enqueue_event inside their own transaction.
"""

import json

from hub_common.sync_contract import SyncEvent
from sqlalchemy import Engine, Row, text

from app.sync.schemas import PendingEvent, RetrySchedule, SyncStatus

LINK_KEY = "earth_link_enabled"

DUE_EVENTS_SQL = text(
    """
    SELECT event_id, type, priority, crew_id, source_ref, payload,
           created_at_onboard_ms, attempts
    FROM outbox
    WHERE status = 'PENDING' AND next_attempt_at_ms <= :now_ms
    ORDER BY priority, created_at_onboard_ms, event_id
    LIMIT :limit
    """
)

STATUS_SQL = text(
    """
    SELECT count(*) FILTER (WHERE status = 'PENDING') AS pending_count,
           count(*) FILTER (WHERE status = 'PENDING' AND type = 'ALERT') AS pending_alerts,
           min(created_at_onboard_ms) FILTER (WHERE status = 'PENDING') AS oldest_pending,
           max(synced_at_ms) AS last_ack_at_ms,
           (SELECT last_error FROM outbox
             WHERE status = 'PENDING' AND last_error IS NOT NULL
             ORDER BY next_attempt_at_ms DESC LIMIT 1) AS last_error
    FROM outbox
    """
)


class PostgresOutboxStore:
    """Outbox and Earth-link state in the onboard database. Example: `PostgresOutboxStore(engine)`."""

    def __init__(self, engine: Engine) -> None:
        self._engine = engine

    def link_enabled(self) -> bool:
        with self._engine.begin() as connection:
            value = connection.execute(
                text("SELECT value FROM settings WHERE key = :key"), {"key": LINK_KEY}
            ).scalar()
        # The migration seeds the key; a missing row means "never turned off".
        return True if value is None else bool(value)

    def set_link_enabled(self, enabled: bool, now_ms: int) -> None:
        with self._engine.begin() as connection:
            connection.execute(
                text(
                    "INSERT INTO settings (key, value, updated_at_ms)"
                    " VALUES (:key, CAST(:value AS jsonb), :now_ms)"
                    " ON CONFLICT (key) DO UPDATE"
                    " SET value = EXCLUDED.value, updated_at_ms = EXCLUDED.updated_at_ms"
                ),
                {"key": LINK_KEY, "value": json.dumps(enabled), "now_ms": now_ms},
            )

    def due_events(self, now_ms: int, limit: int) -> list[PendingEvent]:
        """PENDING events due now: lowest priority first (alerts), then oldest."""
        with self._engine.begin() as connection:
            rows = connection.execute(DUE_EVENTS_SQL, {"now_ms": now_ms, "limit": limit}).all()
        return [_pending_event(row) for row in rows]

    def mark_synced(self, event_ids: list[str], now_ms: int) -> None:
        with self._engine.begin() as connection:
            connection.execute(
                text(
                    "UPDATE outbox SET status = 'SYNCED', synced_at_ms = :now_ms, last_error = NULL"
                    " WHERE event_id = ANY(:ids)"
                ),
                {"ids": event_ids, "now_ms": now_ms},
            )

    def mark_failed(self, schedules: list[RetrySchedule], error: str) -> None:
        with self._engine.begin() as connection:
            connection.execute(
                text(
                    "UPDATE outbox SET attempts = attempts + 1, next_attempt_at_ms = :next,"
                    " last_error = :error WHERE event_id = :event_id"
                ),
                [
                    {"event_id": s.event_id, "next": s.next_attempt_at_ms, "error": error}
                    for s in schedules
                ],
            )

    def status(self, now_ms: int) -> SyncStatus:
        link_enabled = self.link_enabled()
        with self._engine.begin() as connection:
            row = connection.execute(STATUS_SQL).one()
        oldest = row.oldest_pending
        return SyncStatus(
            link_enabled=link_enabled,
            pending_count=row.pending_count,
            pending_alerts=row.pending_alerts,
            oldest_pending_age_ms=None if oldest is None else now_ms - oldest,
            last_ack_at_ms=row.last_ack_at_ms,
            last_error=row.last_error,
        )


def _pending_event(row: Row) -> PendingEvent:
    event = SyncEvent(
        event_id=row.event_id,
        type=row.type,
        priority=row.priority,
        crew_id=row.crew_id,
        source_ref=row.source_ref,
        created_at_onboard_ms=row.created_at_onboard_ms,
        payload=row.payload,
    )
    return PendingEvent(event=event, attempts=row.attempts)
