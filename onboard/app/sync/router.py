"""Sync endpoints (owner: Guilherme), e.g. `GET /v1/sync/status` (pending events, last ACK)
and `PUT /v1/sync/link` (enable or disable the simulated Earth link)."""

from fastapi import APIRouter

router = APIRouter(prefix="/v1/sync", tags=["sync"])
