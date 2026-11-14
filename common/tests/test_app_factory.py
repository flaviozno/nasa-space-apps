import asyncio

from fastapi import APIRouter
from fastapi.testclient import TestClient
from hub_common import build_service_app, create_database_engine
from pydantic import BaseModel


class ProbeSettings(BaseModel):
    flag: str = "on"


def build_probe_router() -> APIRouter:
    router = APIRouter(prefix="/v1/probe")

    @router.get("")
    def read_probe() -> str:
        return "probe"

    return router


def test_service_app_mounts_health_and_routers() -> None:
    engine = create_database_engine("postgresql+psycopg://u:p@nowhere.invalid:5432/db")
    app = build_service_app("probe", ProbeSettings(), engine, [build_probe_router()])
    with TestClient(app) as client:
        assert client.get("/health").json() == {"service": "probe", "status": "ok"}
        assert client.get("/v1/probe").json() == "probe"
    assert app.title == "Probe service"
    assert app.state.settings.flag == "on"
    assert app.state.engine is engine


class RecordingJob:
    """Background job that records whether it started and was cancelled."""

    def __init__(self) -> None:
        self.events: list[str] = []

    async def __call__(self) -> None:
        self.events.append("started")
        try:
            await asyncio.Event().wait()
        except asyncio.CancelledError:
            self.events.append("cancelled")
            raise


def test_background_jobs_run_for_the_app_lifetime() -> None:
    engine = create_database_engine("postgresql+psycopg://u:p@nowhere.invalid:5432/db")
    job = RecordingJob()
    app = build_service_app("probe", ProbeSettings(), engine, [], background_jobs=[job])
    with TestClient(app) as client:
        client.get("/health")
        assert job.events == ["started"]
    assert job.events == ["started", "cancelled"]
