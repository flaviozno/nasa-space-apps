"""Earth view endpoints (owner: Guilherme). The only Earth routes the web proxy exposes,
at `/api/earth/v1/views/*`. Everything shown here already crossed the simulated link."""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request, status
from hub_common import Clock, DatabaseConnection

from app.views import queries
from app.views.assemble import build_alert_views, build_crew_views, build_status_view
from app.views.crew_roster import RosterMember
from app.views.schemas import AlertView, CrewMemberView, EarthStatusView

router = APIRouter(prefix="/v1/views", tags=["views"])


def _now_ms(request: Request) -> int:
    clock: Clock = request.app.state.clock
    return clock.now_ms()


@router.get("/status", response_model=EarthStatusView, response_model_by_alias=True)
def read_status(request: Request, connection: DatabaseConnection) -> EarthStatusView:
    """What Earth received and how late it arrives. Example: `GET /v1/views/status`."""
    return build_status_view(queries.status_row(connection), _now_ms(request))


@router.get("/crew", response_model=list[CrewMemberView], response_model_by_alias=True)
def read_crew(request: Request, connection: DatabaseConnection) -> list[CrewMemberView]:
    """Latest synced value per metric for each crew member, with data age and freshness."""
    return _crew_views(request, connection)


@router.get("/crew/{crew_id}", response_model=CrewMemberView, response_model_by_alias=True)
def read_crew_member(
    crew_id: str, request: Request, connection: DatabaseConnection
) -> CrewMemberView:
    """One crew member. Example: `GET /v1/views/crew/crew-3`."""
    for view in _crew_views(request, connection):
        if view.crew_id == crew_id:
            return view
    raise HTTPException(
        status.HTTP_404_NOT_FOUND, f"crew_id={crew_id!r} not in roster (crew-1 … crew-4)"
    )


@router.get("/alerts", response_model=list[AlertView], response_model_by_alias=True)
def read_alerts(
    request: Request,
    connection: DatabaseConnection,
    crew_id: Annotated[str | None, Query(alias="crewId")] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> list[AlertView]:
    """Synced alerts, newest first (by onboard time). Example: `GET /v1/views/alerts?crewId=crew-3`."""
    rows = queries.recent_alerts(connection, crew_id, limit)
    return build_alert_views(rows, _now_ms(request))


def _crew_views(request: Request, connection: DatabaseConnection) -> list[CrewMemberView]:
    roster: list[RosterMember] = request.app.state.crew_roster
    return build_crew_views(
        roster,
        queries.latest_metrics(connection),
        queries.alert_counts(connection),
        _now_ms(request),
        request.app.state.settings.stale_after_ms,
    )
