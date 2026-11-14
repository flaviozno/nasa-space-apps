"""Earth view endpoints (owner: Guilherme), e.g. `GET /v1/views/crew` (synced data per crew
member), `GET /v1/views/alerts`, `GET /v1/views/status` (last reception, event counts)."""

from fastapi import APIRouter

router = APIRouter(prefix="/v1/views", tags=["views"])
