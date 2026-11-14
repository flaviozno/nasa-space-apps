"""Earth view assembly rules (no database)."""

from pathlib import Path

import pytest
from app.config import EarthSettings
from app.views.assemble import build_crew_views, freshness
from app.views.crew_roster import RosterMember, load_roster
from app.views.queries import LatestMetric
from app.views.schemas import Freshness

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
