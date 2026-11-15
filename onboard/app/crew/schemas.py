"""Pydantic contract for the Crew API (owner: Matheus).

These models define the Crew Hub endpoints the web app consumes: crew list,
baselines, per-metric summaries (z-score vs the fixed baseline), trends,
manual entries, questionnaires, and local alerts.
"""

from enum import Enum
from typing import Annotated

from pydantic import Field

from app.observations.schemas import CamelModel, EpochMs, MetricId, ObservationOut
from app.readiness import ReadinessStatus


class CrewMemberOut(CamelModel):
    """One crew member (no login: the UI picks from this list)."""

    crew_id: str = Field(description="crew-1 .. crew-4")
    name: str
    role: str
    device_id: str = Field(description="Wearable the onboard ingest requests for this member.")


class BaselineValueOut(CamelModel):
    """Fixed pre-flight reference for one metric (contracts/crew.json)."""

    metric: MetricId
    unit: str
    median: float
    spread: float = Field(description="Robust standard deviation (1.4826 x MAD).")


class BaselineOut(CamelModel):
    """All baseline values for one crew member."""

    crew_id: str
    baselines: Annotated[list[BaselineValueOut], Field(max_length=64)]


class ObservationStatus(str, Enum):
    """How the latest value of a metric relates to the baseline and freshness."""

    ok = "OK"
    deviation = "DEVIATION"
    stale = "STALE"
    invalid = "INVALID"
    no_data = "NO_DATA"


class MetricSummaryOut(CamelModel):
    """Latest value of one metric plus its deviation and trend status."""

    metric: MetricId
    label: str
    unit: str
    value: float | None = Field(default=None, description="Latest valid value; null when NO_DATA or INVALID.")
    taken_at: EpochMs | None = None
    z_score: float | None = Field(default=None, description="(value - median) / spread; null without data.")
    status: ObservationStatus


class CrewSummaryOut(CamelModel):
    """Response of `GET /v1/crew/{crewId}/metrics`: every metric for one member."""

    crew_id: str
    generated_at: EpochMs
    metrics: Annotated[list[MetricSummaryOut], Field(max_length=64)]


class TrendPointOut(CamelModel):
    """One point of a metric trend series."""

    taken_at: EpochMs
    value: float | None = None


class MetricTrendOut(CamelModel):
    """Response of `GET /v1/crew/{crewId}/metrics/{metricId}/trends`."""

    crew_id: str
    metric: MetricId
    unit: str
    points: Annotated[list[TrendPointOut], Field(max_length=1000)]


class ManualEntryItemIn(CamelModel):
    """One manual measurement typed by the astronaut."""

    metric: MetricId
    value: float = Field(description="Required for manual entries; use POST /v1/observations for nulls.")
    taken_at: EpochMs | None = None


class ManualEntryIn(CamelModel):
    """Request body of `POST /v1/crew/{crewId}/manual-entries`."""

    entries: Annotated[list[ManualEntryItemIn], Field(min_length=1, max_length=20)]


class ManualEntryOut(CamelModel):
    """Response of the manual entry endpoints."""

    accepted: Annotated[list[ObservationOut], Field(max_length=20)]
    duplicates: int = 0


class DailyCheckinIn(CamelModel):
    """Daily check-in form: how the astronaut feels plus fixed symptoms.

    mood/stress/fatigue use 1-10, sleepiness is the Karolinska scale (1-9),
    and the six symptoms use 0-10 (0 = none).
    """

    mood: Annotated[int, Field(ge=1, le=10)]
    stress: Annotated[int, Field(ge=1, le=10)]
    fatigue: Annotated[int, Field(ge=1, le=10)]
    sleepiness: Annotated[int, Field(ge=1, le=9, description="Karolinska Sleepiness Scale.")]
    symptom_headache: Annotated[int, Field(ge=0, le=10)]
    symptom_back_pain: Annotated[int, Field(ge=0, le=10)]
    symptom_congestion: Annotated[int, Field(ge=0, le=10)]
    symptom_eye_irritation: Annotated[int, Field(ge=0, le=10)]
    symptom_skin: Annotated[int, Field(ge=0, le=10)]
    symptom_nausea: Annotated[int, Field(ge=0, le=10)]


QuestionnaireAnswer = Annotated[int, Field(ge=0, le=3, description="One PHQ-4 question, scored 0-3.")]


class Phq4In(CamelModel):
    """Weekly PHQ-4 questionnaire. The server stores the total (0-12) as the observation."""

    answers: Annotated[list[QuestionnaireAnswer], Field(min_length=4, max_length=4)]


class TeamClimateIn(CamelModel):
    """Weekly team climate self-assessment."""

    score: Annotated[int, Field(ge=1, le=10)]


class QuestionnaireResponseOut(CamelModel):
    """Response of the questionnaire endpoints."""

    response_id: str
    crew_id: str
    questionnaire: str = Field(description="daily_checkin | phq4 | team_climate")
    submitted_at: EpochMs
    total: int | None = Field(default=None, description="PHQ-4 total or team climate score; null for the daily check-in.")
    observations_created: int


class AlertOut(CamelModel):
    """A local alert raised by onboard rules (stored by ingest; read here).

    The final field set follows the ingest branch migration (Miguel's 002);
    these stub fields cover what the Crew Hub renders.
    """

    alert_id: str
    crew_id: str
    rule_id: str
    rule_version: str
    metric: MetricId | None = None
    value: float | None = None
    z_score: float | None = None
    message: str
    created_at: EpochMs


class ReadinessEvidenceOut(CamelModel):
    id: str
    label: str
    value: float
    unit: str
    taken_at: EpochMs
    source: str
    source_ref: str
    detail: str | None = None


class MissionReadinessOut(CamelModel):
    """A local operational recommendation, never a clinical assessment."""

    crew_id: str
    status: ReadinessStatus
    rule_id: str
    rule_version: str
    evaluated_at: EpochMs
    message: str
    sufficient_context: bool
    evidence: list[ReadinessEvidenceOut]
    disclaimer: str
