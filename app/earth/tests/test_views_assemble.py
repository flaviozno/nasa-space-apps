"""Earth view assembly rules (no database)."""

from pathlib import Path
from types import SimpleNamespace

import pytest
from app.config import EarthSettings
from app.views.assemble import build_alert_views, build_crew_views, freshness
from app.views.crew_roster import RosterMember, load_roster
from app.views.queries import LatestMetric
from app.views.schemas import Freshness
from hub_common.sync_contract import AlertPayload, payload_json

ROSTER = [RosterMember("crew-1", "Ana", "Commander"), RosterMember("crew-2", "Kenji", "Pilot")]


def test_freshness_thresholds() -> None:
    assert freshness(None, 600) is Freshness.MISSING
    assert freshness(600, 600) is Freshness.FRESH
    assert freshness(601, 600) is Freshness.STALE


def test_member_without_data_is_missing_and_others_get_ages() -> None:
    latest = [
        LatestMetric("crew-2", "spo2", 97.5, "%", 9_000),
        LatestMetric("crew-2", "heart_rate", 70, "bpm", 2_000),
    ]
    views = build_crew_views(ROSTER, latest, {"crew-2": 3}, now_ms=10_000, stale_after_ms=5_000)
    ana, kenji = views
    assert (ana.freshness, ana.metrics, ana.data_age_ms) == (Freshness.MISSING, [], None)
    assert (kenji.last_measured_at_ms, kenji.data_age_ms, kenji.alert_count) == (9_000, 1_000, 3)
    assert [(m.metric, m.freshness) for m in kenji.metrics] == [
        ("heart_rate", Freshness.STALE),
        ("spo2", Freshness.FRESH),
    ]


def test_roster_comes_from_the_crew_contract() -> None:
    roster = load_roster(EarthSettings().crew_file)
    assert [member.crew_id for member in roster] == ["crew-1", "crew-2", "crew-3", "crew-4"]


def test_missing_roster_file_names_the_path(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError, match="nope.json"):
        load_roster(tmp_path / "nope.json")


def test_mission_readiness_alert_preserves_explanation_on_earth() -> None:
    payload = AlertPayload(
        alert_id="readiness-1",
        rule_id="mission_readiness_context",
        rule_version="1",
        metric="heart_rate",
        value=126,
        z_score=5.0,
        message="Review before a critical task.",
        created_at=9_000,
        recommendation_status="REVIEW_BEFORE_CRITICAL_TASK",
        evidence=[
            {"id": "hr", "label": "Heart rate", "value": 126, "unit": "bpm", "takenAt": 9_000, "source": "wearable", "sourceRef": "sample"},
            {"id": "fatigue", "label": "Fatigue check-in", "value": 8, "unit": "score", "takenAt": 9_000, "source": "questionnaire", "sourceRef": "checkin"},
            {"id": "rad", "label": "Historical reference", "value": 10.2, "unit": "microGy/h", "takenAt": 9_000, "source": "nasa_osdr_radlab", "sourceRef": "dostel"},
        ],
        disclaimer="Historical reference only.",
    )
    row = SimpleNamespace(
        event_id="evt-readiness-1",
        crew_id="crew-1",
        payload=payload_json(payload),
        created_at_onboard_ms=9_000,
        received_at_earth_ms=10_000,
    )
    [view] = build_alert_views([row], now_ms=11_000)
    assert view.recommendation_status == "REVIEW_BEFORE_CRITICAL_TASK"
    assert len(view.evidence) == 3
    assert view.delivery_delay_ms == 1_000
