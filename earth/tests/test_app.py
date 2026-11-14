from pathlib import Path

from app.config import EarthSettings
from app.main import create_app
from fastapi.testclient import TestClient


def build_settings(tmp_path: Path) -> EarthSettings:
    return EarthSettings(database_path=tmp_path / "earth.db")


def test_health_reports_earth(tmp_path: Path) -> None:
    with TestClient(create_app(build_settings(tmp_path))) as client:
        assert client.get("/health").json() == {"service": "earth", "status": "ok"}


def test_startup_creates_the_database(tmp_path: Path) -> None:
    settings = build_settings(tmp_path)
    with TestClient(create_app(settings)):
        assert settings.database_path.exists()
