"""Pure mission-readiness rule tests: no HTTP or database required."""

from app.readiness import Evidence, ReadinessStatus, evaluate_readiness

NOW = 1_700_000_000_000
BASELINE = {"median": 76.0, "spread": 10.0}


def evidence(identifier: str, label: str, value: float, unit: str) -> Evidence:
    return Evidence(identifier, label, value, unit, NOW - 30_000, "test", identifier)


def test_review_requires_all_three_configured_signals() -> None:
    decision = evaluate_readiness(
        heart_rate=evidence("hr", "Heart rate", 126, "bpm"),
        baseline=BASELINE,
        fatigue=evidence("fatigue", "Fatigue check-in", 8, "score"),
        radiation=evidence("rad", "Historical ISS DosTel dose-rate reference", 10.2, "microGy/h"),
        now_ms=NOW,
    )
    assert decision.status is ReadinessStatus.REVIEW_BEFORE_CRITICAL_TASK
    assert decision.heart_rate_z_score == 5.0
    assert len(decision.evidence) == 3


def test_partial_or_missing_context_only_monitors() -> None:
    decision = evaluate_readiness(
        heart_rate=evidence("hr", "Heart rate", 126, "bpm"),
        baseline=BASELINE,
        fatigue=evidence("fatigue", "Fatigue check-in", 4, "score"),
        radiation=evidence("rad", "Historical ISS DosTel dose-rate reference", 10.2, "microGy/h"),
        now_ms=NOW,
    )
    assert decision.status is ReadinessStatus.MONITOR

    missing = evaluate_readiness(
        heart_rate=None,
        baseline=BASELINE,
        fatigue=None,
        radiation=evidence("rad", "Historical ISS DosTel dose-rate reference", 10.2, "microGy/h"),
        now_ms=NOW,
    )
    assert missing.status is ReadinessStatus.MONITOR
    assert not missing.sufficient_context


def test_nominal_complete_context_is_ready() -> None:
    decision = evaluate_readiness(
        heart_rate=evidence("hr", "Heart rate", 76, "bpm"),
        baseline=BASELINE,
        fatigue=evidence("fatigue", "Fatigue check-in", 3, "score"),
        radiation=evidence("rad", "Historical ISS DosTel dose-rate reference", 2.0, "microGy/h"),
        now_ms=NOW,
    )
    assert decision.status is ReadinessStatus.READY


def test_stale_fatigue_does_not_create_a_strong_conclusion() -> None:
    stale = Evidence("fatigue", "Fatigue check-in", 8, "score", NOW - 27 * 3_600_000, "test", "fatigue")
    decision = evaluate_readiness(
        heart_rate=evidence("hr", "Heart rate", 126, "bpm"),
        baseline=BASELINE,
        fatigue=stale,
        radiation=evidence("rad", "Historical ISS DosTel dose-rate reference", 10.2, "microGy/h"),
        now_ms=NOW,
    )
    assert decision.status is ReadinessStatus.MONITOR
    assert not decision.sufficient_context
