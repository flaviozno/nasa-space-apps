"""Backoff and event-building rules (no database)."""

import random

import pytest
from app.sync.backoff import MAX_DELAY_MS, retry_delay_ms
from app.sync.events import build_event
from hub_common.sync_contract import EventType


def test_backoff_doubles_with_bounded_jitter() -> None:
    rng = random.Random(1)
    assert 5_000 <= retry_delay_ms(0, rng) <= 6_000
    assert 20_000 <= retry_delay_ms(2, rng) <= 24_000


def test_backoff_is_capped_at_five_minutes_plus_jitter() -> None:
    assert retry_delay_ms(50, random.Random(2)) <= MAX_DELAY_MS * 1.2


def test_backoff_rejects_negative_attempts() -> None:
    with pytest.raises(ValueError, match="attempts=-1"):
        retry_delay_ms(-1, random.Random(0))


def test_same_source_gives_the_same_event_id() -> None:
    first = build_event(EventType.OBSERVATIONS, "crew-1", "sample-9", {"a": 1}, 10)
    again = build_event(EventType.OBSERVATIONS, "crew-1", "sample-9", {"a": 1}, 20)
    other_type = build_event(EventType.ALERT, "crew-1", "sample-9", {"a": 1}, 10)
    assert first.event_id == again.event_id
    assert first.event_id != other_type.event_id


def test_priority_comes_from_the_type() -> None:
    alert = build_event(EventType.ALERT, "crew-1", "a-1", {}, 10)
    reading = build_event(EventType.OBSERVATIONS, "crew-1", "s-1", {}, 10)
    assert alert.priority < reading.priority
