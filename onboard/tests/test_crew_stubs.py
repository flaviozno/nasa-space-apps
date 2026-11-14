"""Phase 0.4 stub checks: the Crew API answers with fixtures and no database.

These tests pin the contract Wallace consumes: camelCase payloads, 404s for
unknown crew/metric ids, questionnaire validation, and the OpenAPI paths.
"""

from app.config import OnboardSettings
from app.main import create_app
from fastapi.testclient import TestClient

# The engine connects lazily, so these tests run without a database.
UNREACHABLE_DB = "postgresql+psycopg://user:pw@nowhere.invalid:5432/onboard"


def client() -> TestClient:
    return TestClient(create_app(OnboardSettings(database_url=UNREACHABLE_DB)))


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


def test_summary_marks_missing_emulator_metrics_as_no_data() -> None:
    with client() as test_client:
        response = test_client.get("/v1/crew/crew-1/metrics")
    assert response.status_code == 200
    metrics = {item["metric"]: item for item in response.json()["metrics"]}
    assert len(metrics) == 24
    assert metrics["heart_rate"]["status"] == "OK"
    assert metrics["exercise_duration"]["status"] == "NO_DATA"
    assert metrics["exercise_duration"]["value"] is None


def test_summary_shows_a_deviation_for_the_fixture_alert() -> None:
    with client() as test_client:
        response = test_client.get("/v1/crew/crew-3/metrics")
    heart_rate = next(item for item in response.json()["metrics"] if item["metric"] == "heart_rate")
    assert heart_rate["status"] == "DEVIATION"
    assert abs(heart_rate["zScore"]) >= 3


def test_trend_returns_points_oldest_first() -> None:
    with client() as test_client:
        response = test_client.get("/v1/crew/crew-1/metrics/heart_rate/trends", params={"windowMinutes": 30, "maxPoints": 10})
    assert response.status_code == 200
    body = response.json()
    assert body["crewId"] == "crew-1"
    assert body["unit"] == "bpm"
    points = body["points"]
    assert 1 <= len(points) <= 10
    assert all(points[i]["takenAt"] < points[i + 1]["takenAt"] for i in range(len(points) - 1))


def test_trend_for_a_metric_without_emulator_data_is_empty() -> None:
    with client() as test_client:
        response = test_client.get("/v1/crew/crew-1/metrics/hrv_rmssd/trends")
    assert response.status_code == 200
    assert response.json()["points"] == []


def test_unknown_crew_and_metric_return_404() -> None:
    with client() as test_client:
        crew_response = test_client.get("/v1/crew/crew-9/metrics")
        trend_response = test_client.get("/v1/crew/crew-1/metrics/not_a_metric/trends")
    assert crew_response.status_code == 404
    assert trend_response.status_code == 404


def test_manual_entries_echo_with_resolved_units() -> None:
    with client() as test_client:
        response = test_client.post(
            "/v1/crew/crew-2/manual-entries",
            json={"entries": [{"metric": "body_mass", "value": 74.2}]},
        )
    assert response.status_code == 201
    accepted = response.json()["accepted"]
    assert accepted[0]["unit"] == "kg"
    assert accepted[0]["source"] == "manual"
    assert accepted[0]["takenAt"] > 0


def test_daily_checkin_creates_ten_observations() -> None:
    payload = {
        "mood": 7,
        "stress": 3,
        "fatigue": 4,
        "sleepiness": 5,
        "symptomHeadache": 1,
        "symptomBackPain": 0,
        "symptomCongestion": 0,
        "symptomEyeIrritation": 0,
        "symptomSkin": 2,
        "symptomNausea": 0,
    }
    with client() as test_client:
        response = test_client.post("/v1/crew/crew-1/questionnaires/daily-checkin", json=payload)
    assert response.status_code == 201
    body = response.json()
    assert body["questionnaire"] == "daily_checkin"
    assert body["total"] is None
    assert body["observationsCreated"] == 10


def test_daily_checkin_rejects_out_of_scale_answers() -> None:
    payload = {"mood": 0, "stress": 3, "fatigue": 4, "sleepiness": 5,
               "symptomHeadache": 0, "symptomBackPain": 0, "symptomCongestion": 0,
               "symptomEyeIrritation": 0, "symptomSkin": 0, "symptomNausea": 0}
    with client() as test_client:
        response = test_client.post("/v1/crew/crew-1/questionnaires/daily-checkin", json=payload)
    assert response.status_code == 422


def test_phq4_stores_the_total() -> None:
    with client() as test_client:
        response = test_client.post("/v1/crew/crew-1/questionnaires/phq4", json={"answers": [1, 2, 0, 0]})
    assert response.status_code == 201
    assert response.json()["total"] == 3


def test_team_climate_stores_the_score() -> None:
    with client() as test_client:
        response = test_client.post("/v1/crew/crew-4/questionnaires/team-climate", json={"score": 8})
    assert response.status_code == 201
    assert response.json()["total"] == 8


def test_alerts_are_empty_except_the_fixture_member() -> None:
    with client() as test_client:
        quiet = test_client.get("/v1/crew/crew-1/alerts")
        alerting = test_client.get("/v1/crew/crew-3/alerts")
    assert quiet.json() == []
    alerts = alerting.json()
    assert len(alerts) == 1
    assert alerts[0]["metric"] == "heart_rate"
    assert alerts[0]["ruleId"] == "single_reading_zscore"


def test_openapi_exposes_the_stub_paths() -> None:
    app = create_app(OnboardSettings(database_url=UNREACHABLE_DB))
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
