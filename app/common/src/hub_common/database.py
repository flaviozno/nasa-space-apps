"""PostgreSQL engine shared by the onboard and Earth services."""

from sqlalchemy import Engine, create_engine

POSTGRES_SCHEME = "postgresql+psycopg://"


def create_database_engine(database_url: str) -> Engine:
    """Build a pooled SQLAlchemy engine; it connects lazily, on first use.

    Example:
        engine = create_database_engine("postgresql+psycopg://onboard:pw@onboard-db:5432/onboard")
    """
    if not database_url.startswith(POSTGRES_SCHEME):
        raise ValueError(
            f"database_url={database_url!r} must start with {POSTGRES_SCHEME!r} "
            "(PostgreSQL through the psycopg 3 driver)"
        )
    # pre_ping drops connections the database closed (e.g. after a Postgres restart).
    return create_engine(database_url, pool_pre_ping=True)
