import pytest
from hub_common import create_database_engine


def test_accepts_a_psycopg_postgres_url_without_connecting() -> None:
    engine = create_database_engine("postgresql+psycopg://user:pw@nowhere.invalid:5432/db")
    assert engine.dialect.name == "postgresql"
    assert engine.dialect.driver == "psycopg"


def test_rejects_other_databases_with_the_offending_url() -> None:
    with pytest.raises(ValueError, match="sqlite:///x.db"):
        create_database_engine("sqlite:///x.db")
