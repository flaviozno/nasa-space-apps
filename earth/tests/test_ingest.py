"""Earth ingest: auth without a database, idempotency against the real earth-db."""

from app.config import EarthSettings
from app.ingest.store import content_sha256
from app.main import create_app
from fastapi.testclient import TestClient
from hub_common.sync_contract import EventBatch, EventType, SyncEvent
from sqlalchemy import Engine, text

UNREACHABLE_DB = "postgresql+psycopg://user:pw@nowhere.invalid:5432/earth"
TOKEN = {"Authorization": "Bearer ingest-secret"}


class FakeClock:
    def now_ms(self) -> int:
        return 5_000


def make_event(event_id: str, value: int = 1) -> SyncEvent:
    return SyncEvent(
        event_id=event_id,
        type=EventType.OBSERVATIONS,
        priority=1,
        crew_id="crew-2",
        source_ref=f"src-{event_id}",
        created_at_onboard_ms=1_000,
        payload={"observations": [{"metric": "heart_rate", "value": value}]},
    )


def batch_json(batch_id: str, *events: SyncEvent) -> dict:
    batch = EventBatch(batch_id=batch_id, sent_at_onboard_ms=2_000, events=list(events))
    return batch.model_dump(mode="json", by_alias=True)


def build_client(database_url: str) -> TestClient:
    settings = EarthSettings(database_url=database_url, ingest_token="ingest-secret")
    return TestClient(create_app(settings, clock=FakeClock()))


def count(engine: Engine, table: str) -> int:
    with engine.connect() as connection:
        return connection.execute(text(f"SELECT count(*) FROM {table}")).scalar_one()


def test_hash_ignores_key_order() -> None:
    event = make_event("evt-1")
    reordered = SyncEvent.model_validate(dict(reversed(event.model_dump().items())))
    assert content_sha256(event) == content_sha256(reordered)
    assert content_sha256(event) != content_sha256(make_event("evt-1", value=2))


def test_wrong_token_is_rejected_before_touching_the_database() -> None:
    response = build_client(UNREACHABLE_DB).post(
        "/v1/events/batches", json=batch_json("b1", make_event("evt-1"))
    )
    assert response.status_code == 401


def test_new_batch_is_stored_and_acknowledged(clean_tables: Engine) -> None:
    client = build_client(str(clean_tables.url.render_as_string(hide_password=False)))
    response = client.post(
        "/v1/events/batches", json=batch_json("b1", make_event("evt-1")), headers=TOKEN
    )
    assert response.json() == {
        "batchId": "b1",
        "persistedAtMs": 5_000,
        "acceptedEventIds": ["evt-1"],
    }
    assert count(clean_tables, "received_events") == 1


def test_resent_batch_is_confirmed_again_without_duplicates(clean_tables: Engine) -> None:
    client = build_client(str(clean_tables.url.render_as_string(hide_password=False)))
    body = batch_json("b1", make_event("evt-1"))
    client.post("/v1/events/batches", json=body, headers=TOKEN)
    again = client.post("/v1/events/batches", json=body, headers=TOKEN)
    assert again.json()["acceptedEventIds"] == ["evt-1"]
    assert count(clean_tables, "received_events") == 1


def test_same_id_with_other_content_rejects_the_whole_batch(clean_tables: Engine) -> None:
    client = build_client(str(clean_tables.url.render_as_string(hide_password=False)))
    client.post("/v1/events/batches", json=batch_json("b1", make_event("evt-1")), headers=TOKEN)
    changed = batch_json("b2", make_event("evt-1", value=99), make_event("evt-2"))
    response = client.post("/v1/events/batches", json=changed, headers=TOKEN)
    assert response.status_code == 409
    assert response.json() == {"batchId": "b2", "conflictingEventIds": ["evt-1"]}
    assert count(clean_tables, "received_events") == 1  # evt-2 was not stored either
    assert count(clean_tables, "event_conflicts") == 1
