from app.config import OnboardSettings
from app.main import create_app
from fastapi.testclient import TestClient

# The engine connects lazily, so these tests run without a database.
UNREACHABLE_DB = "postgresql+psycopg://user:pw@nowhere.invalid:5432/onboard"


def test_health_reports_onboard() -> None:
    with TestClient(create_app(OnboardSettings(database_url=UNREACHABLE_DB))) as client:
        assert client.get("/health").json() == {"service": "onboard", "status": "ok"}


def test_app_exposes_its_engine() -> None:
    app = create_app(OnboardSettings(database_url=UNREACHABLE_DB))
    assert app.state.engine.url.database == "onboard"


def test_default_crew_file_points_at_the_contract() -> None:
    assert OnboardSettings().crew_file.name == "crew.json"
    assert OnboardSettings().crew_file.exists()
