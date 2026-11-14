"""Crew API endpoints (owner: Matheus), e.g. `GET /v1/crew`, `GET /v1/crew/{crewId}/metrics`,
`POST /v1/crew/{crewId}/questionnaires`, `POST /v1/crew/{crewId}/manual-entries`."""

from fastapi import APIRouter

router = APIRouter(prefix="/v1/crew", tags=["crew"])
