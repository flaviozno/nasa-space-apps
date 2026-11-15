"""Integration tests for the Crew API reads and inputs (needs onboard-db).

Covers the read side (summary z-scores and statuses, trend downsampling) and
the write side (manual entries, questionnaires) including the Outbox event each
submission enqueues in the same transaction.

    uv run pytest tests/test_crew_api.py -v
"""

import time

from app.config import OnboardSettings
from app.main import create_app
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import Engine

BASE = 1_700_000_000_000  # fixed epoch ms so stale checks are deterministic


def api(engine: Engine) -> TestClient:
    """Test client bound to the local onboard-db; Outbox worker off for determinism.

    Uses the settings default URL: `str(engine.url)` would mask the password as
    '***' and break authentication.
    """
    del engine  # availability/isolation comes from clean_tables
    settings = OnboardSettings(sync_worker_enabled=False)
    return TestClient(create_app(settings))


def summary_by_metric(test_client: TestClient, crew_id: str = "crew-1") -> dict:
    response = test_client.get(f"/v1/crew/{crew_id}/metrics")
    assert response.status_code == 200
    return {item["metric"]: item for item in response.json()["metrics"]}


def outbox_events(engine: Engine, crew_id: str) -> list[dict]:
    with engine.connect() as connection:
        rows = connection.execute(
            text("SELECT type, source_ref, payload FROM outbox WHERE crew_id = :crew_id"),
            {"crew_id": crew_id},
        ).mappings().fetchall()
    return [dict(row) for row in rows]


def test_summary_on_an_empty_database_is_all_no_data(clean_tables: Engine) -> None:
    with api(clean_tables) as test_client:
        metrics = summary_by_metric(test_client)
    assert len(metrics) == 24
    assert all(item["status"] == "NO_DATA" for item in metrics.values())
    assert metrics["heart_rate"]["label"] == "Heart rate"
    assert metrics["heart_rate"]["unit"] == "bpm"


def test_action_plan_turns_missing_local_context_into_collection_steps(clean_tables: Engine) -> None:
    with api(clean_tables) as test_client:
        response = test_client.get("/v1/crew/crew-1/action-plan")

    assert response.status_code == 200
    body = response.json()
    assert body["priority"] == "RECHECK"
    assert body["title"] == "Complete a local health check"
    assert [step["actionType"] for step in body["steps"]] == [
        "VERIFY_MEASUREMENT",
        "COMPLETE_CHECKIN",
        "FOLLOW_APPROVED_PROTOCOL",
    ]
    assert "does not diagnose" in body["disclaimer"]


def test_summary_reports_ok_for_a_fresh_normal_value(clean_tables: Engine) -> None:
    now_ms = int(time.time() * 1000)
    with api(clean_tables) as test_client:
        test_client.post(
            "/v1/observations",
            json={"observations": [{
                "crewId": "crew-1", "metric": "heart_rate", "value": 76,
                "source": "wearable", "sourceRef": "emu-ok", "takenAt": now_ms - 30_000,
            }]},
        )
        metrics = summary_by_metric(test_client)
    heart_rate = metrics["heart_rate"]
    assert heart_rate["status"] == "OK"
    assert heart_rate["value"] == 76
    assert heart_rate["zScore"] == 0


def test_summary_flags_a_baseline_deviation(clean_tables: Engine) -> None:
    now_ms = int(time.time() * 1000)
    # crew-1 baseline heart_rate: median 76, spread 10 -> 126 is z = 5 (ALERT_Z is 3).
    with api(clean_tables) as test_client:
        test_client.post(
            "/v1/observations",
            json={"observations": [{
                "crewId": "crew-1", "metric": "heart_rate", "value": 126,
                "source": "wearable", "sourceRef": "emu-high", "takenAt": now_ms - 30_000,
            }]},
        )
        heart_rate = summary_by_metric(test_client)["heart_rate"]
    assert heart_rate["status"] == "DEVIATION"
    assert heart_rate["zScore"] == 5.0


def test_summary_marks_old_wearable_values_as_stale(clean_tables: Engine) -> None:
    now_ms = int(time.time() * 1000)
    # Freshness window for wearable is 5 minutes; 10 minutes is stale.
    with api(clean_tables) as test_client:
        test_client.post(
            "/v1/observations",
            json={"observations": [{
                "crewId": "crew-1", "metric": "heart_rate", "value": 76,
                "source": "wearable", "sourceRef": "emu-old", "takenAt": now_ms - 10 * 60_000,
            }]},
        )
        heart_rate = summary_by_metric(test_client)["heart_rate"]
    assert heart_rate["status"] == "STALE"
    assert heart_rate["value"] == 76


def test_summary_marks_a_null_latest_value_as_invalid(clean_tables: Engine) -> None:
    now_ms = int(time.time() * 1000)
    with api(clean_tables) as test_client:
        test_client.post(
            "/v1/observations",
            json={"observations": [{
                "crewId": "crew-1", "metric": "heart_rate", "value": None,
                "source": "wearable", "sourceRef": "emu-invalid", "takenAt": now_ms,
            }]},
        )
        heart_rate = summary_by_metric(test_client)["heart_rate"]
    assert heart_rate["status"] == "INVALID"
    assert heart_rate["value"] is None


def test_trends_return_real_points_downsampled(clean_tables: Engine) -> None:
    now_ms = int(time.time() * 1000)
    readings = [{"crewId": "crew-1", "metric": "heart_rate", "value": 76 + i,
                 "source": "wearable", "sourceRef": f"emu-t{i}", "takenAt": now_ms - (5 - i) * 60_000}
                for i in range(5)]
    with api(clean_tables) as test_client:
        test_client.post("/v1/observations", json={"observations": readings})
        response = test_client.get(
            "/v1/crew/crew-1/metrics/heart_rate/trends",
            params={"windowMinutes": 30, "maxPoints": 3},
        )
    assert response.status_code == 200
    body = response.json()
    assert body["unit"] == "bpm"
    points = body["points"]
    assert len(points) <= 3
    assert points[-1]["value"] == 80  # the newest reading is always kept
    assert points == sorted(points, key=lambda point: point["takenAt"])


def test_trends_for_a_metric_without_data_are_empty(clean_tables: Engine) -> None:
    with api(clean_tables) as test_client:
        response = test_client.get("/v1/crew/crew-1/metrics/hrv_rmssd/trends")
    assert response.status_code == 200
    assert response.json()["points"] == []


def test_unknown_crew_and_metric_return_404(clean_tables: Engine) -> None:
    with api(clean_tables) as test_client:
        crew_response = test_client.get("/v1/crew/crew-9/metrics")
        trend_response = test_client.get("/v1/crew/crew-1/metrics/not_a_metric/trends")
    assert crew_response.status_code == 404
    assert trend_response.status_code == 404


def test_alerts_read_the_real_ingest_table(clean_tables: Engine) -> None:
    """Seed one ingest alert the way Miguel's worker would, then read it as the hub does."""
    with clean_tables.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO ingest_sessions (session_id, scenario, next_until_acquired_at_ms, updated_at_ms)"
                " VALUES ('sess-1', 'NORMAL', :ts, :ts)"
            ),
            {"ts": BASE},
        )
        connection.execute(
            text(
                "INSERT INTO wearable_samples (sample_id, session_id, crew_id, device_id, boot_id,"
                " sequence_number, acquired_at_ms, payload, received_at_onboard_ms)"
                " VALUES ('smp-1', 'sess-1', 'crew-1', 'wearable-01', 'boot-1', 1, :ts, '{}', :ts)"
            ),
            {"ts": BASE},
        )
        connection.execute(
            text(
                "INSERT INTO alerts (alert_id, crew_id, sample_id, metric, value, z_score, created_at_ms)"
                " VALUES ('alert-1', 'crew-1', 'smp-1', 'heart_rate', 126, 5, :ts)"
            ),
            {"ts": BASE},
        )

    with api(clean_tables) as test_client:
        response = test_client.get("/v1/crew/crew-1/alerts")
        quiet = test_client.get("/v1/crew/crew-4/alerts")

    assert response.status_code == 200
    alerts = response.json()
    assert len(alerts) == 1
    alert = alerts[0]
    assert alert["alertId"] == "alert-1"
    assert alert["sampleId"] == "smp-1"
    assert alert["metric"] == "heart_rate"
    assert alert["value"] == 126
    assert alert["zScore"] == 5
    assert "bpm" in alert["message"] and "126.0" in alert["message"]  # explainable, from the catalog
    assert quiet.status_code == 200
    assert quiet.json() == []


def test_manual_entries_persist_and_enqueue_earth_event(clean_tables: Engine) -> None:
    taken_at = BASE
    payload = {"entries": [{"metric": "body_mass", "value": 74.2, "takenAt": taken_at}]}
    with api(clean_tables) as test_client:
        first = test_client.post("/v1/crew/crew-2/manual-entries", json=payload)
        assert first.status_code == 201
        accepted = first.json()["accepted"]
        assert accepted[0]["unit"] == "kg"
        assert accepted[0]["sourceRef"] == f"manual-crew-2-body_mass-{taken_at}"

        events = outbox_events(clean_tables, "crew-2")
        assert len(events) == 1
        assert events[0]["type"] == "OBSERVATIONS"
        assert events[0]["payload"]["source"] == "manual"

        # Same identity again: duplicate row, and the event id collides -> still one event.
        second = test_client.post("/v1/crew/crew-2/manual-entries", json=payload)
        assert second.json()["duplicates"] == 1
        assert len(outbox_events(clean_tables, "crew-2")) == 1


def test_daily_checkin_creates_ten_observations_and_one_event(clean_tables: Engine) -> None:
    payload = {
        "mood": 7, "stress": 3, "fatigue": 4, "sleepiness": 5,
        "symptomHeadache": 1, "symptomBackPain": 0, "symptomCongestion": 0,
        "symptomEyeIrritation": 0, "symptomSkin": 2, "symptomNausea": 0,
    }
    with api(clean_tables) as test_client:
        response = test_client.post("/v1/crew/crew-1/questionnaires/daily-checkin", json=payload)
        assert response.status_code == 201
        body = response.json()
        assert body["questionnaire"] == "daily_checkin"
        assert body["total"] is None
        assert body["observationsCreated"] == 10
        response_id = body["responseId"]

        stored = test_client.get(
            "/v1/observations",
            params={"crewId": "crew-1", "source": "questionnaire", "limit": 20},
        ).json()
        assert len(stored) == 10
        assert {row["sourceRef"] for row in stored} == {response_id}

        events = outbox_events(clean_tables, "crew-1")
        assert len(events) == 1
        assert events[0]["source_ref"] == response_id
        assert events[0]["payload"]["source"] == "questionnaire"
        assert len(events[0]["payload"]["observations"]) == 10


def test_daily_checkin_rejects_out_of_scale_answers(clean_tables: Engine) -> None:
    payload = {
        "mood": 0, "stress": 3, "fatigue": 4, "sleepiness": 5,
        "symptomHeadache": 0, "symptomBackPain": 0, "symptomCongestion": 0,
        "symptomEyeIrritation": 0, "symptomSkin": 0, "symptomNausea": 0,
    }
    with api(clean_tables) as test_client:
        response = test_client.post("/v1/crew/crew-1/questionnaires/daily-checkin", json=payload)
    assert response.status_code == 422


def test_phq4_stores_the_total(clean_tables: Engine) -> None:
    with api(clean_tables) as test_client:
        response = test_client.post("/v1/crew/crew-1/questionnaires/phq4", json={"answers": [1, 2, 0, 0]})
    assert response.status_code == 201
    body = response.json()
    assert body["total"] == 3
    assert body["observationsCreated"] == 1


def test_team_climate_stores_the_score(clean_tables: Engine) -> None:
    with api(clean_tables) as test_client:
        response = test_client.post("/v1/crew/crew-4/questionnaires/team-climate", json={"score": 8})
    assert response.status_code == 201
    assert response.json()["total"] == 8
