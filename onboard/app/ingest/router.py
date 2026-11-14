"""Ingest endpoints (owner: Miguel). Ingest pulls from the emulator, so this router
only needs inspection routes, e.g. `GET /v1/ingest/status` (cursor, last sync, counts)."""

from fastapi import APIRouter

router = APIRouter(prefix="/v1/ingest", tags=["ingest"])
