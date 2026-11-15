"""Station environment endpoints (owner: Wallace)."""

from typing import Annotated

from fastapi import APIRouter, Query, Request
from hub_common.dependencies import DatabaseConnection

from app.config import OnboardSettings
from app.crew.fixtures import load_contract
from app.environment.radiation import build_radiation_track, load_recent_blocks
from app.environment.schemas import RadiationTrackOut

router = APIRouter(prefix="/v1/environment", tags=["environment"])


@router.get("/radiation", response_model=RadiationTrackOut, summary="Station radiation along the orbit")
def read_radiation(
    request: Request,
    connection: DatabaseConnection,
    window_minutes: Annotated[int, Query(ge=1, le=1440, alias="windowMinutes")] = 120,
) -> RadiationTrackOut:
    """ISS DosTel readings of the last `windowMinutes`, oldest first, for the radiation map.

    Environmental readings of the station, not a personal dose. Built from the radiation
    block stored with each wearable reading; no extra table. Empty until the ingest runs.

    Example: `GET /v1/environment/radiation?windowMinutes=120`.
    """
    settings: OnboardSettings = request.app.state.settings
    crew_ids = [member["crewId"] for member in load_contract(settings.crew_file)["crew"]]
    blocks = load_recent_blocks(connection, crew_ids)
    return build_radiation_track(blocks, request.app.state.clock.now_ms(), window_minutes)
