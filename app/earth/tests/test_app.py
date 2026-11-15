from app.config import EarthSettings
from app.main import create_app
from fastapi.testclient import TestClient

# The engine connects lazily, so these tests run without a database.
UNREACHABLE_DB = "postgresql+psycopg://user:pw@nowhere.invalid:5432/earth"


def test_health_reports_earth() -> None:
    with TestClient(create_app(EarthSettings(database_url=UNREACHABLE_DB))) as client:
        assert client.get("/health").json() == {"service": "earth", "status": "ok"}


def test_app_exposes_its_engine() -> None:
    app = create_app(EarthSettings(database_url=UNREACHABLE_DB))
    assert app.state.engine.url.database == "earth"
