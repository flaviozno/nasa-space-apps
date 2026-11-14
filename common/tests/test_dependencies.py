from pathlib import Path
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient
from hub_common import DatabaseConnection


def test_database_connection_opens_the_configured_database(tmp_path: Path) -> None:
    app = FastAPI()
    app.state.settings = SimpleNamespace(database_path=tmp_path / "service.db")

    @app.get("/journal-mode")
    def read_journal_mode(connection: DatabaseConnection) -> str:
        return connection.execute("PRAGMA journal_mode").fetchone()[0]

    assert TestClient(app).get("/journal-mode").json() == "wal"
    assert (tmp_path / "service.db").exists()
