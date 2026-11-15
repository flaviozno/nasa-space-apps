"""Health endpoint shared by the services (used by Docker healthchecks and the web app)."""

from fastapi import APIRouter
from pydantic import BaseModel


class HealthStatus(BaseModel):
    service: str
    status: str


def build_health_router(service_name: str) -> APIRouter:
    """Return a router exposing `GET /health` for one service.

    Example:
        app.include_router(build_health_router("onboard"))
    """
    router = APIRouter(tags=["health"])

    @router.get("/health", response_model=HealthStatus)
    def read_health() -> HealthStatus:
        return HealthStatus(service=service_name, status="ok")

    return router
