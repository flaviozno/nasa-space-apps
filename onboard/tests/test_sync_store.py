"""Outbox persistence against the real onboard-db (skips when it is not running)."""

import pytest
from app.sync.events import enqueue_event
from app.sync.schemas import RetrySchedule
from app.sync.store import PostgresOutboxStore
from hub_common.sync_contract import EventType, SyncEvent
from sqlalchemy import Engine, text
from sync_fakes import make_event


@pytest.fixture()
def store(integration_engine: Engine) -> PostgresOutboxStore:
    """Empty outbox and the Earth link on."""
    with integration_engine.begin() as connection:
        connection.execute(text("DELETE FROM outbox"))
    outbox_store = PostgresOutboxStore(integration_engine)
    outbox_store.set_link_enabled(True, 0)
    return outbox_store


def enqueue(engine: Engine, *events: SyncEvent) -> list[bool]:
    with engine.begin() as connection:
        return [enqueue_event(connection, event) for event in events]


def test_enqueue_is_idempotent_per_event_id(integration_engine: Engine, store) -> None:
    event = make_event("s1")
    assert enqueue(integration_engine, event, event) == [True, False]
    assert [p.event for p in store.due_events(10**12, 10)] == [event]


def test_rolled_back_producer_leaves_no_event(integration_engine: Engine, store) -> None:
    with pytest.raises(RuntimeError), integration_engine.begin() as connection:
        enqueue_event(connection, make_event("s1"))
        raise RuntimeError("producer failed after enqueueing")
    assert store.due_events(10**12, 10) == []


def test_due_events_put_alerts_first_and_respect_retry_time(
    integration_engine: Engine, store
) -> None:
    reading, alert, later = make_event("r1"), make_event("a1", EventType.ALERT), make_event("r2")
    enqueue(integration_engine, reading, alert, later)
    store.mark_failed([RetrySchedule(later.event_id, 2_000)], "earth unreachable")
    assert [p.event.event_id for p in store.due_events(1_000, 10)] == [
        alert.event_id,
        reading.event_id,
    ]
    assert store.due_events(2_000, 10)[-1].attempts == 1


def test_synced_events_leave_the_queue_and_update_status(integration_engine: Engine, store) -> None:
    alert, reading = make_event("a1", EventType.ALERT), make_event("r1")
    enqueue(integration_engine, alert, reading)
    store.mark_failed([RetrySchedule(reading.event_id, 0)], "earth unreachable")
    store.mark_synced([alert.event_id], 900)
    status = store.status(1_500)
    assert (status.pending_count, status.pending_alerts) == (1, 0)
    assert status.oldest_pending_age_ms == 1_000  # events were created at 500
    assert (status.last_ack_at_ms, status.last_error) == (900, "earth unreachable")


def test_link_setting_persists(store: PostgresOutboxStore) -> None:
    store.set_link_enabled(False, 1)
    assert store.link_enabled() is False
    assert store.status(2).link_enabled is False
