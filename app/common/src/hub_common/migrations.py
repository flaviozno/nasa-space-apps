"""Alembic environment shared by the services' `migrations/env.py` files."""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool


def run_migrations(database_url: str) -> None:
    """Run Alembic online (against the database) or offline (`--sql`, prints SQL).

    Called from each service's migrations/env.py.

    Example:
        run_migrations(OnboardSettings().database_url)
    """
    # Logging sections of alembic.ini: makes "Running upgrade ..." visible in container logs.
    if context.config.config_file_name is not None:
        fileConfig(context.config.config_file_name, disable_existing_loggers=False)
    if context.is_offline_mode():
        run_offline(database_url)
    else:
        run_online(database_url)


def run_offline(database_url: str) -> None:
    """Render migrations as SQL without connecting (`alembic upgrade heads --sql`)."""
    context.configure(url=database_url, literal_binds=True, dialect_opts={"paramstyle": "named"})
    with context.begin_transaction():
        context.run_migrations()


def run_online(database_url: str) -> None:
    """Apply migrations to the database at `database_url`."""
    # NullPool: the migration process opens one connection and exits.
    engine = create_engine(database_url, poolclass=pool.NullPool)
    with engine.connect() as connection:
        context.configure(connection=connection)
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()
