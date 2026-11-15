"""Explainable, local Mission Readiness evaluation for the MVP.

This module deliberately keeps historical ISS DosTel data separate from a crew
member's observations.  It turns a small, explicit evidence set into an
operational prompt, never a diagnosis or individual radiation-dose estimate.
"""

import json
import uuid
from dataclasses import dataclass
from enum import StrEnum
from typing import Any

from hub_common.sync_contract import AlertEvidence, AlertPayload
from sqlalchemy import Connection, text

from app.sync.events import build_alert_event, enqueue_event

RULE_ID = "mission_readiness_context"
RULE_VERSION = "1"
FATIGUE_REVIEW_THRESHOLD = 7.0
HEART_RATE_Z_THRESHOLD = 3.0
RADIATION_REFERENCE_ELEVATED_MICRO_GY_PER_HOUR = 10.0
FATIGUE_FRESHNESS_MS = 26 * 3_600_000
RADIATION_PROVENANCE_URL = "https://visualization.osdr.nasa.gov/radlab/gui/data-api/"
DISCLAIMER = "Historical NASA environmental reference; not a personal radiation dose or medical diagnosis."
_NAMESPACE = uuid.UUID("b881e4c6-efc4-4fd7-9bf6-7ba183fb9444")


class ReadinessStatus(StrEnum):
    READY = "READY"
    MONITOR = "MONITOR"
    REVIEW_BEFORE_CRITICAL_TASK = "REVIEW_BEFORE_CRITICAL_TASK"


@dataclass(frozen=True, slots=True)
class Evidence:
    id: str
    label: str
    value: float
    unit: str
    taken_at_ms: int
    source: str
    source_ref: str
    detail: str | None = None

    def as_alert_evidence(self) -> AlertEvidence:
        return AlertEvidence(
            id=self.id,
            label=self.label,
            value=self.value,
            unit=self.unit,
            taken_at=self.taken_at_ms,
            source=self.source,
            source_ref=self.source_ref,
            detail=self.detail,
        )


@dataclass(frozen=True, slots=True)
class ReadinessDecision:
    status: ReadinessStatus
    message: str
    evidence: tuple[Evidence, ...]
    sufficient_context: bool
    heart_rate_z_score: float | None


def evaluate_readiness(
    *,
    heart_rate: Evidence | None,
    baseline: dict[str, float] | None,
    fatigue: Evidence | None,
    radiation: Evidence | None,
    now_ms: int,
) -> ReadinessDecision:
    """Evaluate the documented three-signal rule without I/O.

    Missing data never becomes zero or a strong conclusion.  A fresh fatigue
    answer, an HR baseline deviation, and an elevated *historical environmental
    reference* must all be present before a review is recommended.
    """
    if heart_rate is None or baseline is None or fatigue is None or radiation is None:
        return ReadinessDecision(
            ReadinessStatus.MONITOR,
            "Mission context is incomplete; monitor before a critical task.",
            tuple(e for e in (heart_rate, fatigue, radiation) if e is not None),
            False,
            None,
        )
    spread = baseline.get("spread", 0.0)
    if spread <= 0 or now_ms - fatigue.taken_at_ms > FATIGUE_FRESHNESS_MS:
        return ReadinessDecision(
            ReadinessStatus.MONITOR,
            "A current fatigue check-in is needed before a critical-task review.",
            (heart_rate, fatigue, radiation),
            False,
            None,
        )

    z_score = (heart_rate.value - baseline["median"]) / spread
    elevated_radiation = radiation.value >= RADIATION_REFERENCE_ELEVATED_MICRO_GY_PER_HOUR
    heart_rate_deviation = abs(z_score) >= HEART_RATE_Z_THRESHOLD
    high_fatigue = fatigue.value >= FATIGUE_REVIEW_THRESHOLD
    evidence = (heart_rate, fatigue, radiation)

    if elevated_radiation and heart_rate_deviation and high_fatigue:
        return ReadinessDecision(
            ReadinessStatus.REVIEW_BEFORE_CRITICAL_TASK,
            "Review before a critical task: heart rate differs from personal baseline, "
            "fatigue is elevated, and a historical environmental radiation reference is elevated.",
            evidence,
            True,
            z_score,
        )
    if elevated_radiation or heart_rate_deviation or high_fatigue:
        return ReadinessDecision(
            ReadinessStatus.MONITOR,
            "Monitor mission readiness: one contextual signal needs attention before a critical task.",
            evidence,
            True,
            z_score,
        )
    return ReadinessDecision(
        ReadinessStatus.READY,
        "No configured mission-readiness signal currently requires review.",
        evidence,
        True,
        z_score,
    )


def persist_radiation_context(
    connection: Connection,
    *,
    observed_at_ms: int,
    source_timestamp: str,
    instrument_id: str,
    dose_rate_micro_gy_per_hour: float,
) -> str:
    """Persist one non-personal historical DosTel reference idempotently."""
    source_ref = f"dostel:{instrument_id}:{source_timestamp}"
    context_id = f"context-{uuid.uuid5(_NAMESPACE, source_ref).hex}"
    connection.execute(
        text(
            """
            INSERT INTO mission_context_snapshots
                (id, kind, value, unit, observed_at_ms, source, source_ref,
                 provenance_url, is_historical, quality)
            VALUES (:id, 'radiation_dose_rate', :value, 'microGy/h', :observed_at_ms,
                    'nasa_osdr_radlab', :source_ref, :provenance_url, TRUE, 'reference')
            ON CONFLICT (source, source_ref) DO NOTHING
            """
        ),
        {
            "id": context_id,
            "value": dose_rate_micro_gy_per_hour,
            "observed_at_ms": observed_at_ms,
            "source_ref": source_ref,
            "provenance_url": RADIATION_PROVENANCE_URL,
        },
    )
    return context_id


def _latest_evidence(connection: Connection, crew_id: str) -> tuple[Evidence | None, Evidence | None, Evidence | None]:
    heart_rate = connection.execute(
        text(
            """SELECT id, value, unit, taken_at, source, source_ref FROM observations
               WHERE crew_id = :crew_id AND metric = 'heart_rate' AND value IS NOT NULL
               ORDER BY taken_at DESC, id DESC LIMIT 1"""
        ),
        {"crew_id": crew_id},
    ).mappings().first()
    fatigue = connection.execute(
        text(
            """SELECT id, value, unit, taken_at, source, source_ref FROM observations
               WHERE crew_id = :crew_id AND metric = 'fatigue' AND value IS NOT NULL
               ORDER BY taken_at DESC, id DESC LIMIT 1"""
        ),
        {"crew_id": crew_id},
    ).mappings().first()
    radiation = connection.execute(
        text(
            """SELECT id, value, unit, observed_at_ms, source, source_ref, provenance_url
               FROM mission_context_snapshots WHERE kind = 'radiation_dose_rate'
               ORDER BY observed_at_ms DESC, id DESC LIMIT 1"""
        )
    ).mappings().first()

    def observation(row: Any, label: str) -> Evidence | None:
        if row is None:
            return None
        return Evidence(row["id"], label, row["value"], row["unit"], row["taken_at"], row["source"], row["source_ref"])

    context = None
    if radiation is not None:
        context = Evidence(
            radiation["id"],
            "Historical ISS DosTel dose-rate reference",
            radiation["value"],
            radiation["unit"],
            radiation["observed_at_ms"],
            radiation["source"],
            radiation["source_ref"],
            radiation["provenance_url"],
        )
    return observation(heart_rate, "Heart rate"), observation(fatigue, "Fatigue check-in"), context


def evaluate_for_crew(
    connection: Connection, crew_id: str, heart_rate_baseline: dict[str, float] | None, now_ms: int
) -> ReadinessDecision:
    """Read current local evidence and return a decision; this function has no side effects."""
    heart_rate, fatigue, radiation = _latest_evidence(connection, crew_id)
    return evaluate_readiness(
        heart_rate=heart_rate,
        baseline=heart_rate_baseline,
        fatigue=fatigue,
        radiation=radiation,
        now_ms=now_ms,
    )


def persist_review_recommendation(
    connection: Connection,
    crew_id: str,
    heart_rate_baseline: dict[str, float] | None,
    now_ms: int,
) -> ReadinessDecision:
    """Persist and enqueue a review once for a fatigue response, when warranted.

    The same daily-checkin observation is the idempotency anchor.  Replayed
    telemetry, a retried request, or an Outbox retry therefore cannot create a
    second operational recommendation.
    """
    decision = evaluate_for_crew(connection, crew_id, heart_rate_baseline, now_ms)
    if decision.status is not ReadinessStatus.REVIEW_BEFORE_CRITICAL_TASK:
        return decision
    fatigue = next(evidence for evidence in decision.evidence if evidence.label == "Fatigue check-in")
    recommendation_id = f"readiness-{uuid.uuid5(_NAMESPACE, f'{crew_id}:{RULE_ID}:{RULE_VERSION}:{fatigue.id}').hex}"
    result = connection.execute(
        text(
            """
            INSERT INTO operational_recommendations
                (id, crew_id, status, rule_id, rule_version, fatigue_observation_id, evidence, message, disclaimer, created_at_ms)
            VALUES (:id, :crew_id, :status, :rule_id, :rule_version, :fatigue_observation_id,
                    CAST(:evidence AS jsonb), :message, :disclaimer, :created_at_ms)
            ON CONFLICT (crew_id, rule_id, rule_version, fatigue_observation_id) DO NOTHING
            RETURNING id
            """
        ),
        {
            "id": recommendation_id,
            "crew_id": crew_id,
            "status": decision.status.value,
            "rule_id": RULE_ID,
            "rule_version": RULE_VERSION,
            "fatigue_observation_id": fatigue.id,
            "evidence": json.dumps([e.as_alert_evidence().model_dump(mode="json", by_alias=True) for e in decision.evidence]),
            "message": decision.message,
            "disclaimer": DISCLAIMER,
            "created_at_ms": now_ms,
        },
    ).first()
    if result is not None:
        heart_rate = next(evidence for evidence in decision.evidence if evidence.label == "Heart rate")
        enqueue_event(
            connection,
            build_alert_event(
                crew_id,
                AlertPayload(
                    alert_id=recommendation_id,
                    rule_id=RULE_ID,
                    rule_version=RULE_VERSION,
                    metric="heart_rate",
                    value=heart_rate.value,
                    z_score=decision.heart_rate_z_score,
                    message=decision.message,
                    created_at=now_ms,
                    recommendation_status=decision.status.value,
                    evidence=[item.as_alert_evidence() for item in decision.evidence],
                    disclaimer=DISCLAIMER,
                ),
                now_ms,
            ),
        )
    return decision
