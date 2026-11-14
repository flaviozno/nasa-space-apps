import random

from app.sync.worker import CycleOutcome, OutboxWorker
from hub_common.sync_contract import EventType
from sync_fakes import FakeClock, FakeEarthSender, FakeOutboxStore, make_event


def build_worker(
    store: FakeOutboxStore, sender: FakeEarthSender, batch_size: int = 100
) -> OutboxWorker:
    return OutboxWorker(store, sender, FakeClock(), batch_size, 5.0, random.Random(0))


def test_link_down_sends_nothing() -> None:
    store = FakeOutboxStore([make_event("s1")], link=False)
    sender = FakeEarthSender()
    assert build_worker(store, sender).run_once().outcome is CycleOutcome.LINK_DOWN
    assert sender.batches == []
    assert len(store.pending) == 1


def test_empty_outbox_is_idle() -> None:
    sender = FakeEarthSender()
    assert build_worker(FakeOutboxStore(), sender).run_once().outcome is CycleOutcome.IDLE
    assert sender.batches == []


def test_confirmed_batch_is_marked_synced() -> None:
    store = FakeOutboxStore([make_event("s1"), make_event("s2")])
    report = build_worker(store, FakeEarthSender()).run_once()
    assert (report.outcome, report.events) == (CycleOutcome.SYNCED, 2)
    assert store.pending == {}
    assert len(store.synced) == 2


def test_alerts_are_sent_before_older_observations() -> None:
    observation = make_event("old-reading")
    alert = make_event("new-alert", EventType.ALERT).model_copy(
        update={"created_at_onboard_ms": 9_999}
    )
    sender = FakeEarthSender()
    build_worker(FakeOutboxStore([observation, alert]), sender, batch_size=1).run_once()
    assert [e.event_id for e in sender.batches[0].events] == [alert.event_id]


def test_unreachable_earth_schedules_a_retry() -> None:
    store = FakeOutboxStore([make_event("s1")])
    report = build_worker(store, FakeEarthSender("unreachable")).run_once()
    schedule, error = store.failures[0]
    assert report.outcome is CycleOutcome.FAILED
    assert "unreachable" in error
    # First retry: 5 s × 2¹ = 10 s, plus up to 20% jitter.
    assert 1_010_000 <= schedule.next_attempt_at_ms <= 1_012_000
    assert len(store.pending) == 1


def test_partial_ack_is_a_failure() -> None:
    store = FakeOutboxStore([make_event("s1"), make_event("s2")])
    report = build_worker(store, FakeEarthSender("partial_ack")).run_once()
    assert report.outcome is CycleOutcome.FAILED
    assert store.synced == []
    assert "does not confirm" in store.failures[0][1]
