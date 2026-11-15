"""Alembic environment for the onboard database (logic shared in hub_common.migrations)."""

from app.config import OnboardSettings
from hub_common.migrations import run_migrations

run_migrations(OnboardSettings().database_url)
