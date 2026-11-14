"""Ingest endpoint (owner: Guilherme): `POST /v1/events/batches` — validate, deduplicate by
eventId, commit, then return the ACK (readme.md, step 6)."""

from fastapi import APIRouter

router = APIRouter(prefix="/v1/events", tags=["ingest"])
