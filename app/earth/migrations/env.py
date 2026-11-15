"""Alembic environment for the Earth database (logic shared in hub_common.migrations)."""

from app.config import EarthSettings
from hub_common.migrations import run_migrations

run_migrations(EarthSettings().database_url)
