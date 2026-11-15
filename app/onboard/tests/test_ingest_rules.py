"""Alert rule engine — Stage A1 (feat/ingest-rules, owner: Miguel).

Pure unit tests: no database, no HTTP, no FastAPI. The ingest loop is wired
in later stages; here we pin the engine's behavior so refactors stay safe.
"""

from app.ingest.rules import (
    AbsoluteRule,
    Baseline,
    Observation,
    ZScoreRule,
    default_rules,
    default_zscore_rules,
    evaluate,
)

NOW_MS = 1_700_000_001_000
TAKEN_AT_MS = 1_700_000_000_000
CREW = "crew-1"

# Fixture rules used only to exercise the AbsoluteRule shape. No default
# absolute rule is shipped today — see onboard/app/ingest/README.md.
_SPO2_ABSOLUTE_FIXTURE = AbsoluteRule(
    id="test_spo2_low",
    version="test-1",
    metric="spo2",
    operator="lt",
    threshold=90.0,
    message_template="SpO2 {value:.1f}% below {threshold}%",
)
_TEMP_ABSOLUTE_FIXTURE = AbsoluteRule(
    id="test_body_temp_high",
    version="test-1",
    metric="body_temp",
    operator="ge",
    threshold=38.0,
    message_template="body_temp {value:.1f} °C at or above {threshold} °C",
)


def observation(metric: str, value: float | None) -> Observation:
    """Build an Observation for the tests with a stable sample id."""
    return Observation(
        crew_id=CREW,
        metric=metric,
        value=value,
        taken_at_ms=TAKEN_AT_MS,
        sample_id=f"sample_{metric}",
    )


# ----- Absolute rule shape --------------------------------------------------


def test_absolute_rule_fires_when_operator_matches() -> None:
    alerts = evaluate(observation("spo2", 85.0), [_SPO2_ABSOLUTE_FIXTURE], {}, NOW_MS)
    assert len(alerts) == 1
    alert = alerts[0]
    assert alert.rule_id == "test_spo2_low"
    assert alert.rule_version == "test-1"
    assert alert.metric == "spo2"
    assert alert.value == 85.0
    assert alert.z_score is None
    assert alert.crew_id == CREW
    assert alert.sample_id == "sample_spo2"
    assert alert.created_at_ms == NOW_MS
    assert "85.0" in alert.message
    assert "90" in alert.message


def test_absolute_rule_does_not_fire_above_threshold() -> None:
    assert evaluate(observation("spo2", 95.0), [_SPO2_ABSOLUTE_FIXTURE], {}, NOW_MS) == []


def test_absolute_ge_operator_fires_on_equal_value() -> None:
    alerts = evaluate(observation("body_temp", 38.0), [_TEMP_ABSOLUTE_FIXTURE], {}, NOW_MS)
    assert len(alerts) == 1
    assert alerts[0].rule_id == "test_body_temp_high"
    assert alerts[0].value == 38.0


def test_absolute_rule_ignores_other_metrics() -> None:
    assert evaluate(observation("heart_rate", 50.0), [_SPO2_ABSOLUTE_FIXTURE], {}, NOW_MS) == []


def test_absolute_le_and_gt_operators() -> None:
    rule_le = AbsoluteRule(
        id="r_le",
        version="1",
        metric="heart_rate",
        operator="le",
        threshold=40.0,
        message_template="HR {value} <= {threshold}",
    )
    rule_gt = AbsoluteRule(
        id="r_gt",
        version="1",
        metric="heart_rate",
        operator="gt",
        threshold=120.0,
        message_template="HR {value} > {threshold}",
    )
    assert len(evaluate(observation("heart_rate", 40.0), [rule_le], {}, NOW_MS)) == 1
    assert evaluate(observation("heart_rate", 41.0), [rule_le], {}, NOW_MS) == []
    assert len(evaluate(observation("heart_rate", 121.0), [rule_gt], {}, NOW_MS)) == 1
    assert evaluate(observation("heart_rate", 120.0), [rule_gt], {}, NOW_MS) == []


def test_null_value_produces_no_alerts() -> None:
    assert evaluate(observation("spo2", None), [_SPO2_ABSOLUTE_FIXTURE], {}, NOW_MS) == []


# ----- Z-score rule ---------------------------------------------------------


def test_zscore_rule_fires_when_deviation_crosses_threshold() -> None:
    (rule,) = default_zscore_rules(("heart_rate",))
    alerts = evaluate(
        observation("heart_rate", 150.0),
        [rule],
        {"heart_rate": Baseline(75, 10)},
        NOW_MS,
    )
    assert len(alerts) == 1
    alert = alerts[0]
    assert alert.rule_id == "single_reading_zscore"
    assert alert.rule_version == "1"
    assert alert.metric == "heart_rate"
    assert alert.z_score == 7.5
    assert alert.value == 150.0
    assert "7.50" in alert.message


def test_zscore_rule_does_not_fire_inside_baseline_band() -> None:
    (rule,) = default_zscore_rules(("heart_rate",))
    assert evaluate(
        observation("heart_rate", 80.0),
        [rule],
        {"heart_rate": Baseline(75, 10)},
        NOW_MS,
    ) == []


def test_zscore_rule_fires_in_both_directions() -> None:
    (rule,) = default_zscore_rules(("spo2",))
    alerts = evaluate(
        observation("spo2", 85.0),
        [rule],
        {"spo2": Baseline(98.0, 1.1)},
        NOW_MS,
    )
    assert len(alerts) == 1
    assert alerts[0].z_score is not None
    assert alerts[0].z_score < 0
    assert abs(alerts[0].z_score) >= 3


def test_zscore_rule_skips_missing_baseline() -> None:
    (rule,) = default_zscore_rules(("heart_rate",))
    assert evaluate(observation("heart_rate", 150.0), [rule], {}, NOW_MS) == []


def test_zscore_rule_tolerates_zero_spread() -> None:
    (rule,) = default_zscore_rules(("heart_rate",))
    assert evaluate(
        observation("heart_rate", 200.0),
        [rule],
        {"heart_rate": Baseline(75, 0)},
        NOW_MS,
    ) == []


def test_zscore_rule_ignores_other_metrics() -> None:
    (rule,) = default_zscore_rules(("heart_rate",))
    assert evaluate(
        observation("spo2", 50.0),
        [rule],
        {"heart_rate": Baseline(75, 10), "spo2": Baseline(98, 1)},
        NOW_MS,
    ) == []


# ----- Default rule set -----------------------------------------------------


def test_default_rules_are_only_zscore() -> None:
    """The project ships no absolute thresholds today (readme.md §11)."""
    rules = default_rules(("heart_rate", "spo2", "body_temp"))
    assert all(isinstance(rule, ZScoreRule) for rule in rules)


def test_default_rules_count_matches_metrics() -> None:
    assert len(default_rules(("heart_rate",))) == 1
    assert len(default_rules(("heart_rate", "spo2", "body_temp"))) == 3


def test_default_rules_stay_quiet_on_normal_scenario() -> None:
    """Covers NORMAL emulator range for the three generated metrics (crew-1)."""
    rules = default_rules(("heart_rate", "spo2", "body_temp"))
    baselines = {
        "heart_rate": Baseline(76, 10),
        "spo2": Baseline(98.0, 1.1),
        "body_temp": Baseline(36.75, 0.45),
    }
    # Extremes of the NORMAL ranges from emu/src/domain/deterministic-generator.ts.
    for metric, value in (
        ("heart_rate", 60.0),
        ("heart_rate", 95.0),
        ("spo2", 96.0),
        ("spo2", 100.0),
        ("body_temp", 36.0),
        ("body_temp", 37.5),
    ):
        assert evaluate(observation(metric, value), rules, baselines, NOW_MS) == [], (
            f"NORMAL value {value} for {metric} should not fire"
        )


def test_default_rules_fire_on_elevated_heart_rate() -> None:
    rules = default_rules(("heart_rate", "spo2", "body_temp"))
    baselines = {
        "heart_rate": Baseline(76, 10),
        "spo2": Baseline(98.0, 1.1),
        "body_temp": Baseline(36.75, 0.45),
    }
    alerts = evaluate(observation("heart_rate", 150.0), rules, baselines, NOW_MS)
    assert [a.rule_id for a in alerts] == ["single_reading_zscore"]
    assert alerts[0].z_score is not None and alerts[0].z_score > 3


def test_default_rules_fire_on_low_spo2() -> None:
    rules = default_rules(("heart_rate", "spo2", "body_temp"))
    baselines = {
        "heart_rate": Baseline(76, 10),
        "spo2": Baseline(98.0, 1.1),
        "body_temp": Baseline(36.75, 0.45),
    }
    alerts = evaluate(observation("spo2", 85.0), rules, baselines, NOW_MS)
    assert [a.rule_id for a in alerts] == ["single_reading_zscore"]
    assert alerts[0].z_score is not None and alerts[0].z_score < -3


# ----- RuleAlert carries context the ingest needs ---------------------------


def test_rule_alert_carries_sample_id_and_crew_for_persistence() -> None:
    """Persistence relies on crew_id, sample_id, created_at_ms coming from the engine."""
    (rule,) = default_zscore_rules(("heart_rate",))
    alert = evaluate(
        Observation(crew_id="crew-3", metric="heart_rate", value=160.0,
                    taken_at_ms=TAKEN_AT_MS, sample_id="sample_abc"),
        [rule],
        {"heart_rate": Baseline(75, 10)},
        NOW_MS,
    )[0]
    assert alert.crew_id == "crew-3"
    assert alert.sample_id == "sample_abc"
    assert alert.created_at_ms == NOW_MS
