"""Generic observation endpoint (owner: Matheus), e.g. `POST /v1/observations` for
future sources that are neither the wearable nor the Crew Hub forms."""

from fastapi import APIRouter

router = APIRouter(prefix="/v1/observations", tags=["observations"])
