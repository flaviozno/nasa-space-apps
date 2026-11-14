"""FastAPI app construction shared by the services."""

from collections.abc import AsyncIterator, Sequence
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from pydantic import BaseModel
from sqlalchemy import Engine

from hub_common.health import build_health_router


def build_service_app(
    service_name: str,
    settings: BaseModel,
    engine: Engine,
    routers: Sequence[APIRouter],
) -> FastAPI:
    """Build a service app with `/health`, the given routers, and `app.state.settings/engine`.

    The schema is managed by Alembic (`alembic upgrade heads`), not at startup; the engine
    is disposed on shutdown.

    Example:
        build_service_app("earth", settings, create_database_engine(url), [views_router])
    """

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        yield
        engine.dispose()

    app = FastAPI(title=f"{service_name.capitalize()} service", version="0.1.0", lifespan=lifespan)
    app.state.settings = settings
    app.state.engine = engine
    app.include_router(build_health_router(service_name))
    for router in routers:
        app.include_router(router)
    return app
