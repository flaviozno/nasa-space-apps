"""FastAPI app construction shared by the services."""

import asyncio
from collections.abc import AsyncIterator, Callable, Coroutine, Sequence
from contextlib import asynccontextmanager, suppress

from fastapi import APIRouter, FastAPI
from pydantic import BaseModel
from sqlalchemy import Engine

from hub_common.health import build_health_router
from hub_common.structured_log import configure_service_logging

BackgroundJob = Callable[[], Coroutine[None, None, None]]


def build_service_app(
    service_name: str,
    settings: BaseModel,
    engine: Engine,
    routers: Sequence[APIRouter],
    background_jobs: Sequence[BackgroundJob] = (),
) -> FastAPI:
    """Build a service app with `/health`, the given routers, and `app.state.settings/engine`.

    The schema is managed by Alembic (`alembic upgrade heads`), not at startup.
    `background_jobs` run as asyncio tasks for the app's lifetime (e.g. the Outbox
    worker) and are cancelled on shutdown, before the engine is disposed.

    Example:
        build_service_app("earth", settings, create_database_engine(url), [views_router])
    """

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        tasks = [asyncio.create_task(job()) for job in background_jobs]
        yield
        await _cancel_all(tasks)
        engine.dispose()

    configure_service_logging(service_name)
    app = FastAPI(title=f"{service_name.capitalize()} service", version="0.1.0", lifespan=lifespan)
    app.state.settings = settings
    app.state.engine = engine
    app.include_router(build_health_router(service_name))
    for router in routers:
        app.include_router(router)
    return app


async def _cancel_all(tasks: list[asyncio.Task[None]]) -> None:
    for task in tasks:
        task.cancel()
    for task in tasks:
        with suppress(asyncio.CancelledError):
            await task
