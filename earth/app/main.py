"""Earth service entry point.

The database schema is managed by Alembic (`alembic upgrade heads`), not at app startup.
"""

from fastapi import FastAPI
from hub_common import Clock, SystemClock, build_service_app, create_database_engine
from sqlalchemy import Engine

from app.config import EarthSettings
from app.ingest.router import router as ingest_router
from app.views.router import router as views_router

ROUTERS = (ingest_router, views_router)


def create_app(
    settings: EarthSettings | None = None,
    engine: Engine | None = None,
    clock: Clock | None = None,
) -> FastAPI:
    """Build the Earth app. Example: `create_app(EarthSettings(), engine=test_engine)`."""
    resolved = settings or EarthSettings()
    resolved_engine = engine or create_database_engine(resolved.database_url)
    app = build_service_app("earth", resolved, resolved_engine, ROUTERS)
    app.state.clock = clock or SystemClock()
    return app


app = create_app()
