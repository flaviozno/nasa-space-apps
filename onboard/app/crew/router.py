"""Crew API endpoints (owner: Matheus).

Reads (summary, trends) query the real observation table and score values
against the fixed baselines in contracts/crew.json. Inputs (manual entries,
questionnaires) persist observations — and their Outbox events, in the same
transaction — so the Earth view receives the whole crew picture (docs/plan.md).
`GET /v1/crew` and `baseline` come straight from the frozen contract.
"""

import json
import uuid
from typing import Annotated

from fastapi import APIRouter, Request
from hub_common.dependencies import DatabaseConnection
from pydantic import Field
from pydantic.alias_generators import to_camel

from app.config import OnboardSettings
from app.crew.fixtures import (
    alerts_for,
    baseline_for,
    crew_members,
    load_contract,
    require_crew_member,
    require_metric,
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
from app.crew.service import summarize, trend_for
from app.observations.catalog import load_catalog, validate_value
from app.observations.catalog import require_metric as require_catalog_metric
from app.observations.outbox import enqueue_observations_event
from app.observations.repository import (
    insert_observations,
    insert_questionnaire_response,
    latest_per_metric,
    range_observations,
)
from app.observations.schemas import ObservationSource

router = APIRouter(prefix="/v1/crew", tags=["crew"])

# Daily check-in answer -> metric id (contracts/metrics.json, questionnaire daily_checkin).
DAILY_CHECKIN_METRICS = (
    "mood",
    "stress",
    "fatigue",
    "sleepiness",
    "symptom_headache",
    "symptom_back_pain",
    "symptom_congestion",
    "symptom_eye_irritation",
    "symptom_skin",
    "symptom_nausea",
)


def _contract(request: Request) -> dict:
    """contracts/crew.json through the app settings (ONBOARD_CREW_FILE overrides it)."""
    settings: OnboardSettings = request.app.state.settings
    return load_contract(settings.crew_file)


def _catalog(request: Request) -> dict:
    """contracts/metrics.json through the app settings (ONBOARD_METRICS_FILE overrides it)."""
    settings: OnboardSettings = request.app.state.settings
    return load_catalog(settings.metrics_file)


def _now_ms(request: Request) -> int:
    """Clock from the app state (SystemClock), injectable in tests."""
    return request.app.state.clock.now_ms()


def _to_out(row: dict) -> ObservationOut:
    """Repository row -> API model."""
    return ObservationOut(
        id=row["id"],
        crew_id=row["crew_id"],
        metric=row["metric"],
        value=row["value"],
        unit=row["unit"],
        source=row["source"],
        source_ref=row["source_ref"],
        taken_at=row["taken_at"],
    )


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
def read_summary(crew_id: str, request: Request, connection: DatabaseConnection) -> CrewSummaryOut:
    """Latest value, z-score, and status per metric (OK, DEVIATION, STALE, INVALID, NO_DATA).

    Status rules: |z| >= 3 against the fixed baseline is DEVIATION; wearable
    values older than 5 minutes (manual/questionnaire 26 h) downgrade OK to
    STALE; a null latest value is INVALID; no rows is NO_DATA — never 0.

    Example: `GET /v1/crew/crew-1/metrics` → 24 metric rows in contract order.
    """
    contract = _contract(request)
    member = require_crew_member(contract, crew_id)
    latest = latest_per_metric(connection, crew_id)
    return summarize(contract, _catalog(request), member, latest, _now_ms(request))


@router.get(
    "/{crew_id}/metrics/{metric_id}/trends",
    response_model=MetricTrendOut,
    summary="Trend series of one metric",
)
def read_trend(
    crew_id: str,
    metric_id: str,
    request: Request,
    connection: DatabaseConnection,
    window_minutes: Annotated[int, Field(default=30, ge=1, le=1440, alias="windowMinutes")] = 30,
    max_points: Annotated[int, Field(default=60, ge=2, le=500, alias="maxPoints")] = 60,
) -> MetricTrendOut:
    """Real trend points for a chart, oldest first, downsampled to maxPoints.

    Example: `GET /v1/crew/crew-1/metrics/heart_rate/trends?windowMinutes=30&maxPoints=30`.
    """
    contract = _contract(request)
    member = require_crew_member(contract, crew_id)
    require_metric(contract, metric_id)
    now = _now_ms(request)
    rows = range_observations(
        connection,
        crew_id,
        metric_id,
        from_ms=now - window_minutes * 60_000,
        to_ms=now,
    )
    return trend_for(contract, _catalog(request), member, metric_id, rows, max_points)


@router.get("/{crew_id}/alerts", response_model=list[AlertOut], summary="Local alerts of one member")
def read_alerts(crew_id: str, request: Request) -> list[AlertOut]:
    """Alerts raised by onboard rules.

    Fixture data for now: the `alerts` table belongs to the ingest branch
    (Miguel); this endpoint reads it once that migration lands.

    Example: `GET /v1/crew/crew-3/alerts` → one ELEVATED_HEART_RATE fixture alert.
    """
    return alerts_for(_contract(request), crew_id)


def _manual_source_ref(crew_id: str, metric: str, taken_at: int) -> str:
    """Stable identity for a manual entry: same member + metric + time = same record.

    Example: _manual_source_ref("crew-2", "body_mass", 1731578400000).
    """
    return f"manual-{crew_id}-{metric}-{taken_at}"


@router.post(
    "/{crew_id}/manual-entries",
    response_model=ManualEntryOut,
    status_code=201,
    summary="Submit manual measurements",
)
def create_manual_entries(
    crew_id: str,
    payload: ManualEntryIn,
    request: Request,
    connection: DatabaseConnection,
) -> ManualEntryOut:
    """Store measurements the astronaut typed (body mass, blood pressure, water, grip).

    Each entry is one source record: validated against the catalog scale,
    persisted with `source=manual`, and queued to Earth through the Outbox in
    the same transaction. Entries without an explicit takenAt share the server
    clock, so re-sending the same request resolves to the same identity and
    counts as duplicates.

    Example: `POST /v1/crew/crew-2/manual-entries` with
    `{"entries": [{"metric": "body_mass", "value": 74.2}]}`.
    """
    contract = _contract(request)
    catalog = _catalog(request)
    member = require_crew_member(contract, crew_id)
    now = _now_ms(request)
    rows: list[dict] = []
    for entry in payload.entries:
        require_metric(contract, entry.metric)
        require_catalog_metric(catalog, entry.metric)
        validate_value(catalog, entry.metric, entry.value)
        taken_at = entry.taken_at if entry.taken_at is not None else now
        rows.append(
            {
                "id": str(uuid.uuid4()),
                "crew_id": member["crewId"],
                "metric": entry.metric,
                "value": entry.value,
                "unit": catalog[entry.metric]["unit"],
                "source": ObservationSource.manual.value,
                "source_ref": _manual_source_ref(member["crewId"], entry.metric, taken_at),
                "taken_at": taken_at,
                "created_at": now,
            }
        )
    inserted_rows, duplicates = insert_observations(connection, rows)
    if inserted_rows:
        enqueue_observations_event(connection, member["crewId"], inserted_rows[0]["source_ref"], inserted_rows)
    return ManualEntryOut(accepted=[_to_out(row) for row in inserted_rows], duplicates=duplicates)


def _questionnaire_rows(
    crew_id: str,
    catalog: dict,
    response_id: str,
    values: dict[str, float],
    submitted_at: int,
) -> list[dict]:
    """Observation rows for one submitted questionnaire (source_ref = response id)."""
    return [
        {
            "id": str(uuid.uuid4()),
            "crew_id": crew_id,
            "metric": metric,
            "value": value,
            "unit": catalog[metric]["unit"],
            "source": ObservationSource.questionnaire.value,
            "source_ref": response_id,
            "taken_at": submitted_at,
            "created_at": submitted_at,
        }
        for metric, value in values.items()
    ]


def _submit_questionnaire(
    crew_id: str,
    questionnaire: str,
    values: dict[str, float],
    raw_answers: dict[str, int],
    request: Request,
    connection: DatabaseConnection,
) -> QuestionnaireResponseOut:
    """Shared path of the three questionnaire endpoints (one transaction).

    Stores the response envelope, one observation per metric, and the Outbox
    event; the response id is the source_ref tying all of them together, so a
    replay of the same submission cannot create a second event at the outbox.
    """
    contract = _contract(request)
    catalog = _catalog(request)
    require_crew_member(contract, crew_id)
    now = _now_ms(request)
    response_id = str(uuid.uuid4())
    insert_questionnaire_response(
        connection,
        {
            "id": response_id,
            "crew_id": crew_id,
            "questionnaire": questionnaire,
            "submitted_at": now,
            "answers_json": json.dumps({to_camel(key): value for key, value in raw_answers.items()}),
        },
    )
    rows = _questionnaire_rows(crew_id, catalog, response_id, values, now)
    inserted_rows, _ = insert_observations(connection, rows)
    enqueue_observations_event(connection, crew_id, response_id, inserted_rows)
    return QuestionnaireResponseOut(
        response_id=response_id,
        crew_id=crew_id,
        questionnaire=questionnaire,
        submitted_at=now,
        total=values.get(questionnaire),
        observations_created=len(inserted_rows),
    )


@router.post(
    "/{crew_id}/questionnaires/daily-checkin",
    response_model=QuestionnaireResponseOut,
    status_code=201,
    summary="Answer the daily check-in",
)
def create_daily_checkin(
    crew_id: str,
    payload: DailyCheckinIn,
    request: Request,
    connection: DatabaseConnection,
) -> QuestionnaireResponseOut:
    """Daily form: mood, stress, fatigue, sleepiness (KSS) and six symptom scores.

    Stores the response envelope, one observation per answer, and the Outbox
    event in one transaction. The MVP does not enforce one-per-day at the API
    level; the UI decides when to show the form.

    Example: `POST /v1/crew/crew-1/questionnaires/daily-checkin` with `{"mood": 7, ...}`.
    """
    values = {metric: getattr(payload, metric) for metric in DAILY_CHECKIN_METRICS}
    return _submit_questionnaire(
        crew_id,
        "daily_checkin",
        values,
        payload.model_dump(by_alias=True),
        request,
        connection,
    )


@router.post(
    "/{crew_id}/questionnaires/phq4",
    response_model=QuestionnaireResponseOut,
    status_code=201,
    summary="Answer the weekly PHQ-4",
)
def create_phq4(
    crew_id: str,
    payload: Phq4In,
    request: Request,
    connection: DatabaseConnection,
) -> QuestionnaireResponseOut:
    """Weekly PHQ-4: four answers scored 0-3; the server stores the total (0-12).

    Example: `POST /v1/crew/crew-1/questionnaires/phq4` with `{"answers": [1, 2, 0, 0]}` → total 3.
    """
    return _submit_questionnaire(
        crew_id,
        "phq4",
        {"phq4": sum(payload.answers)},
        {"answers": payload.answers},
        request,
        connection,
    )


@router.post(
    "/{crew_id}/questionnaires/team-climate",
    response_model=QuestionnaireResponseOut,
    status_code=201,
    summary="Answer the weekly team climate",
)
def create_team_climate(
    crew_id: str,
    payload: TeamClimateIn,
    request: Request,
    connection: DatabaseConnection,
) -> QuestionnaireResponseOut:
    """Weekly team climate self-assessment (1-10).

    Example: `POST /v1/crew/crew-1/questionnaires/team-climate` with `{"score": 8}`.
    """
    return _submit_questionnaire(
        crew_id,
        "team_climate",
        {"team_climate": payload.score},
        {"score": payload.score},
        request,
        connection,
    )
