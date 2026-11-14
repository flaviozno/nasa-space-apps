from pathlib import Path

from app.config import OnboardSettings
from app.main import create_app
from fastapi.testclient import TestClient


def build_settings(tmp_path: Path) -> OnboardSettings:
    return OnboardSettings(database_path=tmp_path / "onboard.db")


def test_health_reports_onboard(tmp_path: Path) -> None:
    with TestClient(create_app(build_settings(tmp_path))) as client:
        assert client.get("/health").json() == {"service": "onboard", "status": "ok"}


def test_startup_creates_the_database(tmp_path: Path) -> None:
    settings = build_settings(tmp_path)
    with TestClient(create_app(settings)):
        assert settings.database_path.exists()


def test_default_crew_file_points_at_the_contract() -> None:
    assert OnboardSettings().crew_file.name == "crew.json"
    assert OnboardSettings().crew_file.exists()
