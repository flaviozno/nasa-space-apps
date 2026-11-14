"""Earth ingest: auth and validation without a database, idempotency against the real earth-db."""

from app.ingest.store import content_sha256
from earth_fakes import INGEST_HEADERS, batch_json, build_client, observation_event
from hub_common.sync_contract import SyncEvent
from sqlalchemy import Engine, text

UNREACHABLE_DB = "postgresql+psycopg://user:pw@nowhere.invalid:5432/earth"


def database_url(engine: Engine) -> str:
    return engine.url.render_as_string(hide_password=False)


def count(engine: Engine, table: str) -> int:
    with engine.connect() as connection:
        return connection.execute(text(f"SELECT count(*) FROM {table}")).scalar_one()


def post(client, body: dict):
    return client.post("/v1/events/batches", json=body, headers=INGEST_HEADERS)


def test_hash_ignores_key_order() -> None:
    event = observation_event("evt-1")
    reordered = SyncEvent.model_validate(dict(reversed(event.model_dump().items())))
    assert content_sha256(event) == content_sha256(reordered)
    assert content_sha256(event) != content_sha256(observation_event("evt-1", heart_rate=99))


def test_wrong_token_is_rejected_before_touching_the_database() -> None:
    response = build_client(UNREACHABLE_DB).post(
        "/v1/events/batches", json=batch_json("b1", observation_event("evt-1"))
    )
    assert response.status_code == 401


def test_payload_not_matching_the_type_is_422() -> None:
    body = batch_json("b1", observation_event("evt-1"))
    body["events"][0]["payload"] = {"source": "wearable"}  # no observations
    assert post(build_client(UNREACHABLE_DB), body).status_code == 422


def test_new_batch_is_stored_and_acknowledged(clean_tables: Engine) -> None:
    response = post(
        build_client(database_url(clean_tables)), batch_json("b1", observation_event("evt-1"))
    )
    assert response.json() == {
        "batchId": "b1",
        "persistedAtMs": 5_000,
        "acceptedEventIds": ["evt-1"],
    }
    assert count(clean_tables, "received_events") == 1


def test_resent_batch_is_confirmed_again_without_duplicates(clean_tables: Engine) -> None:
    client = build_client(database_url(clean_tables))
    body = batch_json("b1", observation_event("evt-1"))
    post(client, body)
    assert post(client, body).json()["acceptedEventIds"] == ["evt-1"]
    assert count(clean_tables, "received_events") == 1


def test_same_id_with_other_content_rejects_the_whole_batch(clean_tables: Engine) -> None:
    client = build_client(database_url(clean_tables))
    post(client, batch_json("b1", observation_event("evt-1")))
    changed = batch_json(
        "b2", observation_event("evt-1", heart_rate=99), observation_event("evt-2")
    )
    response = post(client, changed)
    assert response.status_code == 409
    assert response.json() == {"batchId": "b2", "conflictingEventIds": ["evt-1"]}
    assert count(clean_tables, "received_events") == 1  # evt-2 was not stored either
    assert count(clean_tables, "event_conflicts") == 1
