"""Earth view endpoints against the real earth-db (data enters through the ingest endpoint)."""

from earth_fakes import (
    INGEST_HEADERS,
    FakeClock,
    alert_event,
    batch_json,
    build_client,
    observation_event,
)
from sqlalchemy import Engine


def seeded_client(engine: Engine, clock: FakeClock):
    """Earth with crew-2 readings (an older and a newer one) and two crew-3 alerts."""
    client = build_client(engine.url.render_as_string(hide_password=False), clock)
    events = [
        observation_event("o-old", taken_at=1_000, heart_rate=60, spo2=97.0),
        observation_event("o-new", taken_at=8_000, heart_rate=75),
        alert_event("a-old", created_at=2_000),
        alert_event("a-new", created_at=9_000),
    ]
    response = client.post(
        "/v1/events/batches", json=batch_json("b1", *events), headers=INGEST_HEADERS
    )
    assert response.status_code == 200
    return client


def test_crew_view_shows_latest_values_and_missing_members(clean_tables: Engine) -> None:
    client = seeded_client(clean_tables, FakeClock(10_000))
    crew = {member["crewId"]: member for member in client.get("/v1/views/crew").json()}
    assert crew["crew-1"]["freshness"] == "MISSING"
    kenji = crew["crew-2"]
    assert (kenji["dataAgeMs"], kenji["alertCount"]) == (2_000, 0)
    assert {m["metric"]: m["value"] for m in kenji["metrics"]} == {"heart_rate": 75, "spo2": 97.0}
    assert crew["crew-3"]["alertCount"] == 2


def test_single_member_and_unknown_member(clean_tables: Engine) -> None:
    client = seeded_client(clean_tables, FakeClock(10_000))
    assert client.get("/v1/views/crew/crew-2").json()["name"] == "Kenji Mori"
    assert client.get("/v1/views/crew/crew-9").status_code == 404


def test_alerts_are_newest_first_with_age_and_delay(clean_tables: Engine) -> None:
    client = seeded_client(clean_tables, FakeClock(10_000))
    alerts = client.get("/v1/views/alerts", params={"crewId": "crew-3"}).json()
    assert [a["eventId"] for a in alerts] == ["a-new", "a-old"]
    newest = alerts[0]
    assert (newest["dataAgeMs"], newest["deliveryDelayMs"], newest["zScore"]) == (
        1_000,
        1_000,
        -8.6,
    )
    assert client.get("/v1/views/alerts", params={"crewId": "crew-1"}).json() == []


def test_status_counts_events_and_delivery_delay(clean_tables: Engine) -> None:
    client = seeded_client(clean_tables, FakeClock(10_000))
    status = client.get("/v1/views/status").json()
    assert (status["observationEvents"], status["alertEvents"], status["conflicts"]) == (2, 2, 0)
    assert status["lastReceivedAtMs"] == 10_000
    assert status["newestDataAgeMs"] == 1_000
    # Received at 10_000; created at 1_000, 8_000, 2_000 and 9_000 → mean delay 5_000.
    assert status["averageDeliveryDelayMs"] == 5_000
