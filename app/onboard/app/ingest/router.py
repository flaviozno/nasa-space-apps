"""Status endpoint for the onboard-to-emulator ingestion worker."""

from fastapi import APIRouter
from fastapi import Request

from app.config import OnboardSettings

router = APIRouter(prefix="/v1/ingest", tags=["ingest"])


@router.get("/status")
def ingest_status(request: Request) -> dict[str, object]:
    """Return the durable emulator cursor and latest worker outcome."""
    settings: OnboardSettings = request.app.state.settings
    return request.app.state.ingest_store.status(settings.ingest_session_id)
