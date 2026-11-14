"""Onboard service entry point: mounts each team member's router.

The database schema is managed by Alembic (`alembic upgrade heads`), not at app startup.
"""

from fastapi import FastAPI
from hub_common import build_service_app, create_database_engine
from sqlalchemy import Engine

from app.config import OnboardSettings
from app.crew.router import router as crew_router
from app.ingest.router import router as ingest_router
from app.observations.router import router as observations_router
from app.sync.router import router as sync_router

ROUTERS = (ingest_router, crew_router, observations_router, sync_router)


def create_app(settings: OnboardSettings | None = None, engine: Engine | None = None) -> FastAPI:
    """Build the onboard app. Example: `create_app(OnboardSettings(), engine=test_engine)`."""
    resolved = settings or OnboardSettings()
    resolved_engine = engine or create_database_engine(resolved.database_url)
    return build_service_app("onboard", resolved, resolved_engine, ROUTERS)


app = create_app()
