import pytest
from hub_common.sync_contract import (
    AlertPayload,
    EventBatch,
    EventBatchAck,
    EventType,
    SyncEvent,
    ack_confirms_batch,
    payload_json,
)
from pydantic import ValidationError


def build_event(event_id: str) -> SyncEvent:
    return SyncEvent(
        event_id=event_id,
        type=EventType.OBSERVATIONS,
        priority=1,
        crew_id="crew-1",
        source_ref=f"src-{event_id}",
        created_at_onboard_ms=1_000,
        payload={
            "source": "wearable",
            "observations": [{"metric": "heart_rate", "value": 70, "unit": "bpm", "takenAt": 900}],
        },
    )


def build_batch(*event_ids: str) -> EventBatch:
    return EventBatch(
        batch_id="bat-1", sent_at_onboard_ms=2_000, events=[build_event(e) for e in event_ids]
    )


def test_event_serializes_as_camel_case() -> None:
    body = build_event("evt-1").model_dump(mode="json", by_alias=True)
    assert body["eventId"] == "evt-1"
    assert body["createdAtOnboardMs"] == 1_000
    assert body["dataSource"] == "SIMULATED"


def test_batch_parses_camel_case_json() -> None:
    raw = build_batch("evt-1").model_dump_json(by_alias=True)
    assert EventBatch.model_validate_json(raw).events[0].crew_id == "crew-1"


def test_batch_rejects_more_than_100_events() -> None:
    with pytest.raises(ValidationError, match="at most 100"):
        build_batch(*[f"evt-{i}" for i in range(101)])


def test_ack_must_name_the_batch_and_every_event() -> None:
    batch = build_batch("evt-1", "evt-2")
    full = EventBatchAck(batch_id="bat-1", persisted_at_ms=3, accepted_event_ids=["evt-2", "evt-1"])
    partial = full.model_copy(update={"accepted_event_ids": ["evt-1"]})
    other_batch = full.model_copy(update={"batch_id": "bat-2"})
    assert ack_confirms_batch(batch, full)
    assert not ack_confirms_batch(batch, partial)
    assert not ack_confirms_batch(batch, other_batch)


def test_payload_is_validated_against_the_type() -> None:
    with pytest.raises(ValidationError, match="unit"):
        SyncEvent(
            event_id="evt-1",
            type=EventType.OBSERVATIONS,
            priority=1,
            crew_id="crew-1",
            source_ref="s",
            created_at_onboard_ms=1,
            payload={
                "source": "manual",
                "observations": [{"metric": "spo2", "value": 1, "takenAt": 1}],
            },
        )


def test_payload_json_uses_camel_case() -> None:
    alert = AlertPayload(
        alert_id="a", rule_id="r", rule_version="1", message="m", created_at=1, z_score=-3.5
    )
    assert payload_json(alert)["zScore"] == -3.5


def test_alert_payload_carries_bounded_mission_readiness_evidence() -> None:
    alert = AlertPayload(
        alert_id="readiness-1",
        rule_id="mission_readiness_context",
        rule_version="1",
        message="Review before a critical task.",
        created_at=1,
        recommendation_status="REVIEW_BEFORE_CRITICAL_TASK",
        evidence=[
            {"id": "hr", "label": "Heart rate", "value": 126, "unit": "bpm", "takenAt": 1, "source": "wearable", "sourceRef": "sample"},
            {"id": "fatigue", "label": "Fatigue check-in", "value": 8, "unit": "score", "takenAt": 1, "source": "questionnaire", "sourceRef": "checkin"},
            {"id": "rad", "label": "Historical reference", "value": 10.2, "unit": "microGy/h", "takenAt": 1, "source": "nasa_osdr_radlab", "sourceRef": "dostel"},
        ],
    )
    body = payload_json(alert)
    assert body["recommendationStatus"] == "REVIEW_BEFORE_CRITICAL_TASK"
    assert len(body["evidence"]) == 3
