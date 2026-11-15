"""Generic observation endpoints (owner: Matheus).

`POST /v1/observations` accepts any source (future integrations) and persists
through the observations repository with idempotency on (source, sourceRef,
metric). `GET /v1/observations` queries the real table with filters. One
transactional connection per request comes from DatabaseConnection (hub_common):
commit on success, rollback on error.
"""

import uuid
from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Query, Request
from hub_common.dependencies import DatabaseConnection

from app.config import OnboardSettings
from app.crew.fixtures import load_contract, require_crew_member
from app.observations.catalog import load_catalog, require_metric, validate_value
from app.observations.outbox import enqueue_row_events
from app.observations.repository import insert_observations, query_observations
from app.observations.schemas import ObservationBatchIn, ObservationBatchOut, ObservationOut

router = APIRouter(prefix="/v1/observations", tags=["observations"])


def _settings(request: Request) -> OnboardSettings:
    return request.app.state.settings


def _now_ms() -> int:
    return int(datetime.now(UTC).timestamp() * 1000)


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


@router.post("", response_model=ObservationBatchOut, status_code=201, summary="Accept observation batches")
def create_observations(
    payload: ObservationBatchIn,
    request: Request,
    connection: DatabaseConnection,
) -> ObservationBatchOut:
    """Generic input for sources that are neither the wearable nor the Crew Hub forms.

    Validates crew and metric ids against the contracts, rejects readings outside
    the catalog scale, resolves the unit, and persists idempotently: repeating the
    same (source, sourceRef, metric) counts as a duplicate instead of creating a
    second row. `value: null` is stored as an INVALID reading, never 0. The
    response lists only the rows that actually persisted, and each persisted row
    is queued to Earth through the Outbox (same transaction).

    Example: `POST /v1/observations` with
    `{"observations": [{"crewId": "crew-1", "metric": "heart_rate", "value": 82}]}`.
    """
    settings = _settings(request)
    crew = load_contract(settings.crew_file)
    catalog = load_catalog(settings.metrics_file)
    now = _now_ms()
    rows: list[dict] = []
    for item in payload.observations:
        require_crew_member(crew, item.crew_id)
        require_metric(catalog, item.metric)
        validate_value(catalog, item.metric, item.value)
        rows.append(
            {
                "id": str(uuid.uuid4()),
                "crew_id": item.crew_id,
                "metric": item.metric,
                "value": item.value,
                "unit": catalog[item.metric]["unit"],
                "source": item.source.value,
                "source_ref": item.source_ref,
                "taken_at": item.taken_at if item.taken_at is not None else now,
                "created_at": now,
            }
        )
    inserted_rows, duplicates = insert_observations(connection, rows)
    enqueue_row_events(connection, inserted_rows)
    return ObservationBatchOut(
        accepted=[_to_out(row) for row in inserted_rows],
        duplicates=duplicates,
    )


@router.get("", response_model=list[ObservationOut], summary="Query observations")
def list_observations(
    request: Request,
    connection: DatabaseConnection,
    crew_id: Annotated[str | None, Query(alias="crewId")] = None,
    metric: Annotated[str | None, Query()] = None,
    source: Annotated[Literal["wearable", "manual", "questionnaire"] | None, Query()] = None,
    from_ms: Annotated[int | None, Query(alias="fromMs", ge=0)] = None,
    to_ms: Annotated[int | None, Query(alias="toMs", ge=0)] = None,
    limit: Annotated[int, Query(ge=1, le=1000)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[ObservationOut]:
    """Query the real observation table with filters; ordered oldest first.

    Example: `GET /v1/observations?crewId=crew-1&metric=heart_rate&limit=50`.
    """
    settings = _settings(request)
    if crew_id is not None:
        require_crew_member(load_contract(settings.crew_file), crew_id)
    if metric is not None:
        require_metric(load_catalog(settings.metrics_file), metric)
    rows = query_observations(
        connection,
        crew_id,
        metric=metric,
        source=source,
        from_ms=from_ms,
        to_ms=to_ms,
        limit=limit,
        offset=offset,
    )
    return [_to_out(dict(row)) for row in rows]
