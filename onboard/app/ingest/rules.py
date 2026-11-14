"""Alert rules for the wearable ingest — owner: Miguel.

Two rule shapes supported by the engine, both experimental (readme.md §8, §11):

- `AbsoluteRule`: fires when a reading crosses a fixed threshold. Shape is
  implemented for future use (e.g. a clinically-validated SpO2 limit); no
  absolute rule is part of the default set today — see the module README.
- `ZScoreRule`: fires when |z| >= threshold against the fixed baseline in
  `contracts/crew.json`, where ``z = (value - median) / spread``. The contracts
  tests calibrate the emulator so NORMAL never fires and the anomaly scenarios
  cross |z| = 3 (contracts/README.md).

The engine is pure: no HTTP, no database, no FastAPI. The ingest loop calls
:func:`evaluate` for every converted observation and persists the returned
:class:`RuleAlert`\\s in the ``alerts`` table, unique by
``(sample_id, rule_id, rule_version, metric)``.
"""

from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True, slots=True)
class Baseline:
    """Fixed pre-flight reference for one metric (contracts/crew.json).

    ``spread`` is a robust standard deviation (1.4826 x MAD). Questionnaire
    metrics use a floor of 1 scale point so the spread never collapses to
    zero (contracts/README.md).
    """

    median: float
    spread: float


@dataclass(frozen=True, slots=True)
class Observation:
    """One reading evaluated by the engine, already in the catalog unit.

    ``value`` is None when the sample was invalid (``sensorStatus = INVALID``)
    or outside the metric scale. In both cases the engine returns no alerts
    (readme.md §7: "null = invalid reading (never 0)").
    """

    crew_id: str
    metric: str
    value: float | None
    taken_at_ms: int
    sample_id: str | None = None


Operator = Literal["lt", "le", "gt", "ge"]


@dataclass(frozen=True, slots=True)
class AbsoluteRule:
    """Fires when the observation value crosses a fixed threshold.

    No absolute rule is in the default set today. See the module README for
    why; the shape is ready for a clinically-validated threshold.

    Example:
        >>> AbsoluteRule(
        ...     id="example_spo2_low",
        ...     version="exp-1",
        ...     metric="spo2",
        ...     operator="lt",
        ...     threshold=90.0,
        ...     message_template="SpO2 {value:.1f}% below {threshold}%",
        ... )
    """

    id: str
    version: str
    metric: str
    operator: Operator
    threshold: float
    message_template: str


@dataclass(frozen=True, slots=True)
class ZScoreRule:
    """Fires when |z| >= threshold against the baseline in crew.json.

    Example:
        >>> ZScoreRule(
        ...     id="single_reading_zscore",
        ...     version="1",
        ...     metric="heart_rate",
        ...     threshold=3.0,
        ...     message_template="{metric} value {value} at z={z_score:.2f}",
        ... )
    """

    id: str
    version: str
    metric: str
    threshold: float
    message_template: str


Rule = AbsoluteRule | ZScoreRule


@dataclass(frozen=True, slots=True)
class RuleAlert:
    """Alert produced by one rule firing on one observation.

    The ingest persists this into the ``alerts`` table and emits an ALERT
    event to the outbox (readme.md §5; common.sync_contract.AlertPayload).
    """

    crew_id: str
    rule_id: str
    rule_version: str
    metric: str
    value: float
    z_score: float | None
    message: str
    sample_id: str | None
    created_at_ms: int


_OPERATORS: dict[Operator, Callable[[float, float], bool]] = {
    "lt": lambda value, threshold: value < threshold,
    "le": lambda value, threshold: value <= threshold,
    "gt": lambda value, threshold: value > threshold,
    "ge": lambda value, threshold: value >= threshold,
}


def _evaluate_absolute(
    rule: AbsoluteRule,
    observation: Observation,
    now_ms: int,
) -> RuleAlert | None:
    if observation.metric != rule.metric or observation.value is None:
        return None
    if not _OPERATORS[rule.operator](observation.value, rule.threshold):
        return None
    message = rule.message_template.format(
        metric=rule.metric,
        value=observation.value,
        operator=rule.operator,
        threshold=rule.threshold,
    )
    return RuleAlert(
        crew_id=observation.crew_id,
        rule_id=rule.id,
        rule_version=rule.version,
        metric=rule.metric,
        value=observation.value,
        z_score=None,
        message=message,
        sample_id=observation.sample_id,
        created_at_ms=now_ms,
    )


def _evaluate_zscore(
    rule: ZScoreRule,
    observation: Observation,
    baseline: Baseline | None,
    now_ms: int,
) -> RuleAlert | None:
    if observation.metric != rule.metric or observation.value is None:
        return None
    if baseline is None or baseline.spread <= 0:
        return None
    z_score = (observation.value - baseline.median) / baseline.spread
    if abs(z_score) < rule.threshold:
        return None
    message = rule.message_template.format(
        metric=rule.metric,
        value=observation.value,
        threshold=rule.threshold,
        median=baseline.median,
        spread=baseline.spread,
        z_score=z_score,
    )
    return RuleAlert(
        crew_id=observation.crew_id,
        rule_id=rule.id,
        rule_version=rule.version,
        metric=rule.metric,
        value=observation.value,
        z_score=z_score,
        message=message,
        sample_id=observation.sample_id,
        created_at_ms=now_ms,
    )


def evaluate(
    observation: Observation,
    rules: Sequence[Rule],
    baselines: Mapping[str, Baseline],
    now_ms: int,
) -> list[RuleAlert]:
    """Run every rule against one observation and return the alerts.

    Rules whose ``metric`` differs from the observation are skipped, and an
    observation with ``value is None`` produces no alerts.

    Example:
        >>> alerts = evaluate(
        ...     Observation("crew-3", "heart_rate", 150.0, 1_700_000_000_000),
        ...     [ZScoreRule("single_reading_zscore", "1", "heart_rate", 3.0,
        ...                 "{metric} z={z_score:.2f}")],
        ...     {"heart_rate": Baseline(75, 10)},
        ...     now_ms=1_700_000_001_000,
        ... )
        >>> alerts[0].z_score
        7.5
    """
    if observation.value is None:
        return []
    alerts: list[RuleAlert] = []
    for rule in rules:
        if isinstance(rule, AbsoluteRule):
            found = _evaluate_absolute(rule, observation, now_ms)
        else:
            found = _evaluate_zscore(rule, observation, baselines.get(rule.metric), now_ms)
        if found is not None:
            alerts.append(found)
    return alerts


# ----- Default rule set -----------------------------------------------------
#
# The default set uses only the z-score rule, calibrated against the fixed
# baselines in contracts/crew.json. ALERT_Z = 3.0 is the same threshold that
# contracts/tests/test_crew_baseline.py expects: NORMAL stays below |z| = 3,
# anomaly scenarios cross it. No absolute threshold is shipped by default
# because none is clinically validated in this project (readme.md §11).

# ALERT_Z in contracts/tests/test_crew_baseline.py.
SINGLE_READING_ZSCORE_THRESHOLD = 3.0


def default_zscore_rules(metrics: Sequence[str]) -> tuple[ZScoreRule, ...]:
    """Build one z-score rule per metric, all sharing ``single_reading_zscore``.

    The ``alerts`` table is unique by (sample_id, rule_id, rule_version,
    metric), so the same rule id can fire on several metrics of the same
    sample.

    Example:
        >>> [rule.metric for rule in default_zscore_rules(("heart_rate", "spo2"))]
        ['heart_rate', 'spo2']
    """
    return tuple(
        ZScoreRule(
            id="single_reading_zscore",
            version="1",
            metric=metric,
            threshold=SINGLE_READING_ZSCORE_THRESHOLD,
            message_template=(
                "{metric} value {value} is {z_score:.2f} spreads from baseline "
                "(median {median}, spread {spread})"
            ),
        )
        for metric in metrics
    )


def default_rules(wearable_metrics: Sequence[str]) -> tuple[Rule, ...]:
    """Default rule set: one z-score rule per metric.

    Kept as a wrapper so callers don't depend on the internal composition:
    a future validated absolute threshold can be added here without touching
    the ingest cycle.

    Example:
        >>> len(default_rules(("heart_rate", "spo2", "body_temp")))
        3
    """
    return default_zscore_rules(wearable_metrics)
