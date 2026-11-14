"""Named fakes for the Outbox worker and sync endpoints (no database, no network)."""

from app.sync.earth_client import EarthDeliveryError
from app.sync.events import build_alert_event, build_observations_event
from app.sync.schemas import PendingEvent, RetrySchedule, SyncStatus
from hub_common.sync_contract import (
    AlertPayload,
    EventBatch,
    EventBatchAck,
    EventType,
    ObservationItem,
    ObservationsPayload,
    SyncEvent,
)


class FakeClock:
    def __init__(self, now_ms: int = 1_000_000) -> None:
        self.now = now_ms

    def now_ms(self) -> int:
        return self.now


def make_event(source_ref: str, event_type: EventType = EventType.OBSERVATIONS) -> SyncEvent:
    """A valid event created at onboard time 500 for crew-1."""
    if event_type is EventType.ALERT:
        alert = AlertPayload(
            alert_id=source_ref, rule_id="r", rule_version="1", message="m", created_at=500
        )
        return build_alert_event("crew-1", alert, 500)
    item = ObservationItem(metric="heart_rate", value=72, unit="bpm", taken_at=500)
    payload = ObservationsPayload(source="wearable", observations=[item])
    return build_observations_event("crew-1", source_ref, payload, 500)


class FakeOutboxStore:
    """In-memory outbox: PENDING events, link flag, and what the worker recorded."""

    def __init__(self, events: list[SyncEvent] | None = None, link: bool = True) -> None:
        self.pending = {e.event_id: PendingEvent(e, 0) for e in events or []}
        self.link = link
        self.synced: list[str] = []
        self.failures: list[tuple[RetrySchedule, str]] = []

    def link_enabled(self) -> bool:
        return self.link

    def set_link_enabled(self, enabled: bool, now_ms: int) -> None:
        self.link = enabled

    def due_events(self, now_ms: int, limit: int) -> list[PendingEvent]:
        ordered = sorted(
            self.pending.values(),
            key=lambda p: (p.event.priority, p.event.created_at_onboard_ms, p.event.event_id),
        )
        return ordered[:limit]

    def mark_synced(self, event_ids: list[str], now_ms: int) -> None:
        self.synced.extend(event_ids)
        for event_id in event_ids:
            self.pending.pop(event_id)

    def mark_failed(self, schedules: list[RetrySchedule], error: str) -> None:
        self.failures.extend((schedule, error) for schedule in schedules)

    def status(self, now_ms: int) -> SyncStatus:
        return SyncStatus(
            link_enabled=self.link,
            pending_count=len(self.pending),
            pending_alerts=sum(p.event.type is EventType.ALERT for p in self.pending.values()),
            oldest_pending_age_ms=None,
            last_ack_at_ms=None,
            last_error=None,
        )


class FakeEarthSender:
    """Earth that confirms batches, or fails / answers a bad ACK when told to."""

    def __init__(self, mode: str = "ack") -> None:
        self.mode = mode
        self.batches: list[EventBatch] = []

    def send_batch(self, batch: EventBatch) -> EventBatchAck:
        self.batches.append(batch)
        if self.mode == "unreachable":
            raise EarthDeliveryError("earth unreachable: ConnectError")
        accepted = [e.event_id for e in batch.events]
        if self.mode == "partial_ack":
            accepted = accepted[:-1]
        return EventBatchAck(
            batch_id=batch.batch_id, persisted_at_ms=1, accepted_event_ids=accepted
        )
