"""Onboard service entry point: mounts each team member's router and the Outbox worker.

The database schema is managed by Alembic (`alembic upgrade heads`), not at app startup.
"""

import httpx
from fastapi import FastAPI
from hub_common import BackgroundJob, Clock, SystemClock, build_service_app, create_database_engine
from sqlalchemy import Engine

from app.config import OnboardSettings
from app.crew.router import router as crew_router
from app.ingest.router import router as ingest_router
from app.observations.router import router as observations_router
from app.sync.earth_client import HttpEarthClient
from app.sync.router import router as sync_router
from app.sync.store import PostgresOutboxStore
from app.sync.worker import EarthBatchSender, OutboxStore, OutboxWorker

ROUTERS = (ingest_router, crew_router, observations_router, sync_router)


def create_app(
    settings: OnboardSettings | None = None,
    engine: Engine | None = None,
    outbox_store: OutboxStore | None = None,
    earth_sender: EarthBatchSender | None = None,
    clock: Clock | None = None,
) -> FastAPI:
    """Build the onboard app. Example: `create_app(OnboardSettings(), engine=test_engine)`."""
    resolved = settings or OnboardSettings()
    resolved_engine = engine or create_database_engine(resolved.database_url)
    store = outbox_store or PostgresOutboxStore(resolved_engine)
    resolved_clock = clock or SystemClock()
    jobs = _sync_jobs(resolved, store, earth_sender, resolved_clock)
    app = build_service_app("onboard", resolved, resolved_engine, ROUTERS, jobs)
    app.state.outbox_store = store
    app.state.clock = resolved_clock
    return app


def _sync_jobs(
    settings: OnboardSettings, store: OutboxStore, sender: EarthBatchSender | None, clock: Clock
) -> list[BackgroundJob]:
    if not settings.sync_worker_enabled:
        return []
    http = httpx.Client(base_url=settings.earth_url, timeout=settings.sync_timeout_s)
    resolved_sender = sender or HttpEarthClient(http, settings.earth_ingest_token)
    worker = OutboxWorker(
        store, resolved_sender, clock, settings.sync_batch_size, settings.sync_interval_s
    )
    return [worker.run_forever]


app = create_app()
