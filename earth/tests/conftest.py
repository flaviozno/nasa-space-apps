"""Shared fixtures for tests that need the real Earth database.

Run the database first (from the repo root): `docker compose up -d earth-db`,
then apply the migrations (from earth/): `uv run alembic upgrade heads`.
Tests skip when the database is unreachable, so the suite stays green anywhere.
"""

from collections.abc import Iterator

import pytest
from app.config import EarthSettings
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import OperationalError

TABLES = ("received_events", "event_conflicts")


@pytest.fixture(scope="session")
def integration_engine() -> Iterator[Engine]:
    """Engine for the local earth-db; skips the test when it is not running."""
    engine = create_engine(EarthSettings().database_url, pool_pre_ping=True)
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except OperationalError:
        pytest.skip("earth-db is not running (docker compose up -d earth-db)")
    yield engine
    engine.dispose()


@pytest.fixture()
def clean_tables(integration_engine: Engine) -> Engine:
    """Engine with the ingest tables emptied before the test."""
    with integration_engine.begin() as connection:
        for table in TABLES:
            connection.execute(text(f"DELETE FROM {table}"))
    return integration_engine
