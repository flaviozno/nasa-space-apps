"""Earth service entry point."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from hub_common import build_health_router, prepare_database

from app.config import EarthSettings
from app.ingest.router import router as ingest_router
from app.views.router import router as views_router


def create_app(settings: EarthSettings | None = None) -> FastAPI:
    """Build the Earth app. Example: `create_app(EarthSettings(database_path=tmp))`."""
    resolved = settings or EarthSettings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        prepare_database(resolved.database_path, resolved.schema_dir)
        yield

    app = FastAPI(title="Earth service", version="0.1.0", lifespan=lifespan)
    app.state.settings = resolved
    for router in (build_health_router("earth"), ingest_router, views_router):
        app.include_router(router)
    return app


app = create_app()
