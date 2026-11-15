"""Phase 0.4 contract checks that do not need a database.

Everything that reads or writes PostgreSQL moved to the integration tests
(test_observations_api.py, test_crew_api.py). These pin the pieces that come
straight from the frozen contracts: crew list, baselines, fixture alerts, and
the OpenAPI surface.
"""

from app.config import OnboardSettings
from app.main import create_app
from fastapi.testclient import TestClient

# The engine connects lazily and the Outbox worker stays off: these tests run
# without a database.
UNREACHABLE_DB = "postgresql+psycopg://user:pw@nowhere.invalid:5432/onboard"


def client() -> TestClient:
    settings = OnboardSettings(database_url=UNREACHABLE_DB, sync_worker_enabled=False)
    return TestClient(create_app(settings))


def test_crew_list_matches_the_contract() -> None:
    with client() as test_client:
        response = test_client.get("/v1/crew")
    assert response.status_code == 200
    crew = response.json()
    assert [member["crewId"] for member in crew] == ["crew-1", "crew-2", "crew-3", "crew-4"]
    assert crew[0]["deviceId"] == "wearable-01"


def test_baseline_lists_every_contract_metric() -> None:
    with client() as test_client:
        response = test_client.get("/v1/crew/crew-1/baseline")
    assert response.status_code == 200
    baselines = response.json()["baselines"]
    assert len(baselines) == 24
    heart_rate = next(item for item in baselines if item["metric"] == "heart_rate")
    assert heart_rate == {"metric": "heart_rate", "unit": "bpm", "median": 76, "spread": 10}


def test_openapi_exposes_the_crew_api_paths() -> None:
    app = create_app(OnboardSettings(database_url=UNREACHABLE_DB, sync_worker_enabled=False))
    paths = app.openapi()["paths"]
    for path in (
        "/v1/crew",
        "/v1/crew/{crew_id}/baseline",
        "/v1/crew/{crew_id}/metrics",
        "/v1/crew/{crew_id}/metrics/{metric_id}/trends",
        "/v1/crew/{crew_id}/alerts",
        "/v1/crew/{crew_id}/manual-entries",
        "/v1/crew/{crew_id}/questionnaires/daily-checkin",
        "/v1/crew/{crew_id}/questionnaires/phq4",
        "/v1/crew/{crew_id}/questionnaires/team-climate",
        "/v1/observations",
    ):
        assert path in paths, f"missing {path}"
