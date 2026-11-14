"""Onboard service entry point: builds the app and mounts each team member's router."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from hub_common import build_health_router, prepare_database

from app.config import OnboardSettings
from app.crew.router import router as crew_router
from app.ingest.router import router as ingest_router
from app.observations.router import router as observations_router
from app.sync.router import router as sync_router


def create_app(settings: OnboardSettings | None = None) -> FastAPI:
    """Build the onboard app. Example: `create_app(OnboardSettings(database_path=tmp))`."""
    resolved = settings or OnboardSettings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        prepare_database(resolved.database_path, resolved.schema_dir)
        yield

    app = FastAPI(title="Onboard service", version="0.1.0", lifespan=lifespan)
    app.state.settings = resolved
    for router in (
        build_health_router("onboard"),
        ingest_router,
        crew_router,
        observations_router,
        sync_router,
    ):
        app.include_router(router)
    return app


app = create_app()
