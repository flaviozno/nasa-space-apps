"""Named fakes and event builders shared by the Earth tests."""

from app.config import EarthSettings
from app.main import create_app
from fastapi.testclient import TestClient
from hub_common.sync_contract import (
    AlertPayload,
    EventBatch,
    EventType,
    ObservationItem,
    ObservationsPayload,
    SyncEvent,
    payload_json,
)

INGEST_HEADERS = {"Authorization": "Bearer ingest-secret"}


class FakeClock:
    def __init__(self, now_ms: int = 5_000) -> None:
        self.now = now_ms

    def now_ms(self) -> int:
        return self.now


def observation_event(
    event_id: str, crew_id: str = "crew-2", taken_at: int = 1_000, **values: float
) -> SyncEvent:
    """OBSERVATIONS event; `values` maps metric → value (default heart_rate=72)."""
    items = [
        ObservationItem(metric=metric, value=value, unit="u", taken_at=taken_at)
        for metric, value in (values or {"heart_rate": 72}).items()
    ]
    payload = ObservationsPayload(source="wearable", observations=items)
    return SyncEvent(
        event_id=event_id,
        type=EventType.OBSERVATIONS,
        priority=1,
        crew_id=crew_id,
        source_ref=f"src-{event_id}",
        created_at_onboard_ms=taken_at,
        payload=payload_json(payload),
    )


def alert_event(event_id: str, crew_id: str = "crew-3", created_at: int = 1_000) -> SyncEvent:
    alert = AlertPayload(
        alert_id=f"alert-{event_id}",
        rule_id="single_reading_zscore",
        rule_version="1",
        metric="spo2",
        value=88.5,
        z_score=-8.6,
        message="SpO2 far below baseline",
        created_at=created_at,
    )
    return SyncEvent(
        event_id=event_id,
        type=EventType.ALERT,
        priority=0,
        crew_id=crew_id,
        source_ref=alert.alert_id,
        created_at_onboard_ms=created_at,
        payload=payload_json(alert),
    )


def batch_json(batch_id: str, *events: SyncEvent) -> dict:
    batch = EventBatch(batch_id=batch_id, sent_at_onboard_ms=2_000, events=list(events))
    return batch.model_dump(mode="json", by_alias=True)


def build_client(database_url: str, clock: FakeClock | None = None) -> TestClient:
    settings = EarthSettings(database_url=database_url, ingest_token="ingest-secret")
    return TestClient(create_app(settings, clock=clock or FakeClock()))
