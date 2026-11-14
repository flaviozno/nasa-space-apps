"""Crew API endpoints (owner: Matheus).

Phase 0.4 stubs: real Pydantic contracts, fixture responses derived from
contracts/crew.json. The web app can already build the Crew Hub against the
OpenAPI schema; the real implementation swaps fixtures for PostgreSQL queries
(one transactional connection per request through DatabaseConnection).
"""

from typing import Annotated

from fastapi import APIRouter, Request
from pydantic import Field

from app.config import OnboardSettings
from app.crew.fixtures import (
    alerts_for,
    baseline_for,
    crew_members,
    load_contract,
    now_ms,
    require_crew_member,
    require_metric,
    stable_id,
    summary_for,
    trend_for,
)
from app.crew.schemas import (
    AlertOut,
    BaselineOut,
    CrewMemberOut,
    CrewSummaryOut,
    DailyCheckinIn,
    ManualEntryIn,
    ManualEntryOut,
    MetricTrendOut,
    ObservationOut,
    Phq4In,
    QuestionnaireResponseOut,
    TeamClimateIn,
)
from app.observations.schemas import ObservationSource

router = APIRouter(prefix="/v1/crew", tags=["crew"])


def _contract(request: Request) -> dict:
    """contracts/crew.json through the app settings (ONBOARD_CREW_FILE overrides it)."""
    settings: OnboardSettings = request.app.state.settings
    return load_contract(settings.crew_file)


@router.get("", response_model=list[CrewMemberOut], summary="List the crew")
def list_crew(request: Request) -> list[CrewMemberOut]:
    """Return the crew members (no login: the UI lets the astronaut pick one).

    Example: `GET /v1/crew` → `[{"crewId": "crew-1", "name": "Ana Ribeiro", ...}]`.
    """
    return crew_members(_contract(request))


@router.get("/{crew_id}/baseline", response_model=BaselineOut, summary="Baselines of one member")
def read_baseline(crew_id: str, request: Request) -> BaselineOut:
    """Fixed pre-flight reference values used for z-score deviations.

    Example: `GET /v1/crew/crew-1/baseline` → `{"crewId": "crew-1", "baselines": [...]}`.
    """
    contract = _contract(request)
    return baseline_for(contract, require_crew_member(contract, crew_id))


@router.get("/{crew_id}/metrics", response_model=CrewSummaryOut, summary="Metric summary of one member")
def read_summary(crew_id: str, request: Request) -> CrewSummaryOut:
    """Latest value, z-score, and status per metric (OK, DEVIATION, STALE, INVALID, NO_DATA).

    Example: `GET /v1/crew/crew-3/metrics` → heart_rate with status DEVIATION in the fixture.
    """
    contract = _contract(request)
    return summary_for(contract, require_crew_member(contract, crew_id))


@router.get("/{crew_id}/metrics/{metric_id}/trends", response_model=MetricTrendOut, summary="Trend series of one metric")
def read_trend(
    crew_id: str,
    metric_id: str,
    request: Request,
    window_minutes: Annotated[int, Field(default=30, ge=1, le=1440, alias="windowMinutes")] = 30,
    max_points: Annotated[int, Field(default=60, ge=2, le=500, alias="maxPoints")] = 60,
) -> MetricTrendOut:
    """Trend points for a chart, oldest first, downsampled to maxPoints.

    Example: `GET /v1/crew/crew-1/metrics/heart_rate/trends?windowMinutes=30&maxPoints=30`.
    """
    contract = _contract(request)
    member = require_crew_member(contract, crew_id)
    require_metric(contract, metric_id)
    return trend_for(contract, member, metric_id, window_minutes, max_points)


@router.get("/{crew_id}/alerts", response_model=list[AlertOut], summary="Local alerts of one member")
def read_alerts(crew_id: str, request: Request) -> list[AlertOut]:
    """Alerts raised by onboard rules. Final fields follow the ingest branch schema.

    Example: `GET /v1/crew/crew-3/alerts` → one ELEVATED_HEART_RATE fixture alert.
    """
    return alerts_for(_contract(request), crew_id)


@router.post(
    "/{crew_id}/manual-entries",
    response_model=ManualEntryOut,
    status_code=201,
    summary="Submit manual measurements",
)
def create_manual_entries(crew_id: str, payload: ManualEntryIn, request: Request) -> ManualEntryOut:
    """Store measurements the astronaut typed (body mass, blood pressure, water, grip).

    Stub: echoes the entries as observations with resolved units and `source=manual`.

    Example: `POST /v1/crew/crew-2/manual-entries` with `{"entries": [{"metric": "body_mass", "value": 74.2}]}`.
    """
    contract = _contract(request)
    member = require_crew_member(contract, crew_id)
    timestamp = now_ms()
    accepted = []
    for index, entry in enumerate(payload.entries):
        taken_at = entry.taken_at if entry.taken_at is not None else timestamp
        accepted.append(
            ObservationOut(
                id=stable_id("obs", member["crewId"], entry.metric, taken_at or index),
                crew_id=member["crewId"],
                metric=entry.metric,
                value=entry.value,
                unit=contract["metrics"][entry.metric]["unit"],
                source=ObservationSource.manual,
                source_ref=f"manual-{member['crewId']}-{entry.metric}-{taken_at}",
                taken_at=taken_at,
            )
        )
    return ManualEntryOut(accepted=accepted, duplicates=0)


def _questionnaire_response(crew_id: str, questionnaire: str, total: int | None, created: int) -> QuestionnaireResponseOut:
    return QuestionnaireResponseOut(
        response_id=stable_id("resp", crew_id, questionnaire),
        crew_id=crew_id,
        questionnaire=questionnaire,
        submitted_at=now_ms(),
        total=total,
        observations_created=created,
    )


@router.post(
    "/{crew_id}/questionnaires/daily-checkin",
    response_model=QuestionnaireResponseOut,
    status_code=201,
    summary="Answer the daily check-in",
)
def create_daily_checkin(crew_id: str, payload: DailyCheckinIn, request: Request) -> QuestionnaireResponseOut:
    """Daily form: mood, stress, fatigue, sleepiness (KSS) and six symptom scores.

    Stub: returns the receipt; the real endpoint stores one observation per answer.

    Example: `POST /v1/crew/crew-1/questionnaires/daily-checkin` with `{"mood": 7, ...}`.
    """
    require_crew_member(_contract(request), crew_id)
    return _questionnaire_response(crew_id, "daily_checkin", None, 10)


@router.post(
    "/{crew_id}/questionnaires/phq4",
    response_model=QuestionnaireResponseOut,
    status_code=201,
    summary="Answer the weekly PHQ-4",
)
def create_phq4(crew_id: str, payload: Phq4In, request: Request) -> QuestionnaireResponseOut:
    """Weekly PHQ-4: four answers scored 0-3; the server stores the total (0-12).

    Example: `POST /v1/crew/crew-1/questionnaires/phq4` with `{"answers": [1, 2, 0, 0]}` → total 3.
    """
    require_crew_member(_contract(request), crew_id)
    return _questionnaire_response(crew_id, "phq4", sum(payload.answers), 1)


@router.post(
    "/{crew_id}/questionnaires/team-climate",
    response_model=QuestionnaireResponseOut,
    status_code=201,
    summary="Answer the weekly team climate",
)
def create_team_climate(crew_id: str, payload: TeamClimateIn, request: Request) -> QuestionnaireResponseOut:
    """Weekly team climate self-assessment (1-10).

    Example: `POST /v1/crew/crew-1/questionnaires/team-climate` with `{"score": 8}`.
    """
    require_crew_member(_contract(request), crew_id)
    return _questionnaire_response(crew_id, "team_climate", payload.score, 1)
