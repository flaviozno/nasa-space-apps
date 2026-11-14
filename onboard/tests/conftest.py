"""Shared fixtures for tests that need the real onboard database.

Run the database first (from the repo root): `docker compose up -d onboard-db`,
then apply the migrations (from onboard/): `uv run alembic upgrade heads`.

Tests skip when the database is unreachable, so the suite stays green on any
machine — the same idea as the UNREACHABLE_DB trick in test_app.py.
"""

import pytest
from app.config import OnboardSettings
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import OperationalError

TABLES = ("observations", "questionnaire_responses")


@pytest.fixture(scope="session")
def integration_engine() -> Engine:
    """Engine for the local onboard-db; skips the test when it is not running."""
    engine = create_engine(OnboardSettings().database_url, pool_pre_ping=True)
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except OperationalError:
        pytest.skip("onboard-db is not running (docker compose up -d onboard-db)")
    yield engine
    engine.dispose()


@pytest.fixture()
def clean_tables(integration_engine: Engine) -> Engine:
    """Engine with the observations module tables emptied before the test."""
    with integration_engine.begin() as connection:
        for table in TABLES:
            connection.execute(text(f"DELETE FROM {table}"))
    return integration_engine
