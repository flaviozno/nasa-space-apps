"""Generic observation endpoints (owner: Matheus).

Phase 0.4 stubs: `POST /v1/observations` accepts any source (future integrations)
and `GET /v1/observations` answers fixture history. The real implementation
persists through the observations branch migration with idempotency on
(source, sourceRef, metric).
"""

from typing import Annotated, Literal

from fastapi import APIRouter, Query, Request

from app.crew.fixtures import load_contract, require_crew_member, require_metric
from app.observations.fixtures import accept_batch, sample_observations
from app.observations.schemas import ObservationBatchIn, ObservationBatchOut, ObservationOut

router = APIRouter(prefix="/v1/observations", tags=["observations"])


@router.post("", response_model=ObservationBatchOut, status_code=201, summary="Accept observation batches")
def create_observations(payload: ObservationBatchIn, request: Request) -> ObservationBatchOut:
    """Generic input for sources that are neither the wearable nor the Crew Hub forms.

    Validates crew and metric ids and echoes the batch with resolved units (stub).
    The real endpoint is idempotent: repeating the same (source, sourceRef, metric)
    counts as a duplicate instead of creating a second row.

    Example: `POST /v1/observations` with `{"observations": [{"crewId": "crew-1", "metric": "steps"}]}`.
    """
    contract = load_contract(request.app.state.settings.crew_file)
    for item in payload.observations:
        require_crew_member(contract, item.crew_id)
        require_metric(contract, item.metric)
    return accept_batch(payload, contract)


@router.get("", response_model=list[ObservationOut], summary="Query observations")
def list_observations(
    request: Request,
    crew_id: Annotated[str | None, Query(alias="crewId")] = None,
    metric: Annotated[str | None, Query()] = None,
    source: Annotated[Literal["wearable", "manual", "questionnaire"] | None, Query()] = None,
    from_ms: Annotated[int | None, Query(alias="fromMs", ge=0)] = None,
    to_ms: Annotated[int | None, Query(alias="toMs", ge=0)] = None,
    limit: Annotated[int, Query(ge=1, le=1000)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[ObservationOut]:
    """Query observations with filters; results are ordered oldest first.

    Stub: ignores metric/source/time filters and returns fixture history for the
    requested crew member (defaults to crew-1).

    Example: `GET /v1/observations?crewId=crew-1&limit=6`.
    """
    contract = load_contract(request.app.state.settings.crew_file)
    resolved_crew = crew_id or "crew-1"
    require_crew_member(contract, resolved_crew)
    return sample_observations(contract, resolved_crew, limit)
