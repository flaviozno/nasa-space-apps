from collections.abc import Iterator
from contextlib import contextmanager

from fastapi import FastAPI
from fastapi.testclient import TestClient
from hub_common import DatabaseConnection


class FakeConnection:
    """Stands in for a SQLAlchemy Connection inside an endpoint."""

    def __init__(self, label: str) -> None:
        self.label = label


class FakeEngine:
    """Stands in for a SQLAlchemy Engine; records how each transaction ended."""

    def __init__(self) -> None:
        self.outcomes: list[str] = []

    @contextmanager
    def begin(self) -> Iterator[FakeConnection]:
        try:
            yield FakeConnection(f"tx-{len(self.outcomes) + 1}")
            self.outcomes.append("commit")
        except Exception:
            self.outcomes.append("rollback")
            raise


def build_app(engine: FakeEngine) -> FastAPI:
    app = FastAPI()
    app.state.engine = engine

    @app.get("/ok")
    def read_ok(connection: DatabaseConnection) -> str:
        return connection.label

    @app.get("/boom")
    def read_boom(connection: DatabaseConnection) -> str:
        raise RuntimeError(f"failure inside {connection.label}")

    return app


def test_endpoint_receives_a_connection_and_commits() -> None:
    engine = FakeEngine()
    assert TestClient(build_app(engine)).get("/ok").json() == "tx-1"
    assert engine.outcomes == ["commit"]


def test_endpoint_error_rolls_back() -> None:
    engine = FakeEngine()
    client = TestClient(build_app(engine), raise_server_exceptions=False)
    assert client.get("/boom").status_code == 500
    assert engine.outcomes == ["rollback"]
