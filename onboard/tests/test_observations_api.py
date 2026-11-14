"""Integration tests for the real observation endpoints (needs onboard-db).

Same skip-when-down behavior as the repository tests: these run against the
local onboard-db through the real app stack (engine, transaction, repository).

    uv run pytest tests/test_observations_api.py -v
"""

from app.config import OnboardSettings
from app.main import create_app
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine


def api(engine: Engine) -> TestClient:
    """Test client bound to the local onboard-db (same default URL the engine uses)."""
    return TestClient(create_app(OnboardSettings()))


def test_post_persists_and_is_idempotent(clean_tables: Engine) -> None:
    payload = {
        "observations": [
            {"crewId": "crew-1", "metric": "heart_rate", "value": 82, "source": "wearable", "sourceRef": "emu-it-1"},
        ],
    }
    with api(clean_tables) as test_client:
        first = test_client.post("/v1/observations", json=payload)
        assert first.status_code == 201
        body = first.json()
        assert body["duplicates"] == 0
        assert len(body["accepted"]) == 1
        assert body["accepted"][0]["unit"] == "bpm"
        assert body["accepted"][0]["takenAt"] > 0  # server filled the missing takenAt

        # Same identity again: counted as a duplicate, nothing new persisted.
        second = test_client.post("/v1/observations", json=payload)
        assert second.json()["duplicates"] == 1
        assert second.json()["accepted"] == []


def test_post_rejects_unknown_metric_and_out_of_scale_values(clean_tables: Engine) -> None:
    with api(clean_tables) as test_client:
        unknown = test_client.post(
            "/v1/observations",
            json={"observations": [{"crewId": "crew-1", "metric": "not_a_metric", "value": 1}]},
        )
        assert unknown.status_code == 404

        out_of_scale = test_client.post(
            "/v1/observations",
            json={"observations": [{"crewId": "crew-1", "metric": "heart_rate", "value": 500}]},
        )
        assert out_of_scale.status_code == 422

        invalid_reading = test_client.post(
            "/v1/observations",
            json={"observations": [{"crewId": "crew-1", "metric": "heart_rate", "value": None}]},
        )
        assert invalid_reading.status_code == 201  # null = INVALID reading, never 0


def test_null_value_round_trips_through_the_api(clean_tables: Engine) -> None:
    payload = {
        "observations": [
            {"crewId": "crew-2", "metric": "spo2", "value": None, "source": "wearable", "sourceRef": "emu-invalid"},
        ],
    }
    with api(clean_tables) as test_client:
        test_client.post("/v1/observations", json=payload)
        rows = test_client.get("/v1/observations", params={"crewId": "crew-2"}).json()

    assert len(rows) == 1
    assert rows[0]["value"] is None
    assert rows[0]["unit"] == "%"


def test_get_applies_filters(clean_tables: Engine) -> None:
    payload = {
        "observations": [
            {
                "crewId": "crew-1",
                "metric": "heart_rate",
                "value": 80,
                "source": "wearable",
                "sourceRef": "emu-a",
                "takenAt": 1_700_000_000_000,
            },
            {
                "crewId": "crew-1",
                "metric": "spo2",
                "value": 97,
                "source": "wearable",
                "sourceRef": "emu-b",
                "takenAt": 1_700_000_000_001,
            },
            {
                "crewId": "crew-2",
                "metric": "body_mass",
                "value": 74.2,
                "source": "manual",
                "sourceRef": "manual-a",
                "takenAt": 1_700_000_000_002,
            },
        ],
    }
    with api(clean_tables) as test_client:
        test_client.post("/v1/observations", json=payload)

        everything = test_client.get("/v1/observations", params={"crewId": "crew-1"}).json()
        assert [row["metric"] for row in everything] == ["heart_rate", "spo2"]

        by_metric = test_client.get("/v1/observations", params={"crewId": "crew-1", "metric": "spo2"}).json()
        assert [row["sourceRef"] for row in by_metric] == ["emu-b"]

        by_source = test_client.get("/v1/observations", params={"source": "manual"}).json()
        assert [row["sourceRef"] for row in by_source] == ["manual-a"]

        unknown_crew = test_client.get("/v1/observations", params={"crewId": "crew-9"})
        assert unknown_crew.status_code == 404
