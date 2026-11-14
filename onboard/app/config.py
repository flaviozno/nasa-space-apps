"""Onboard settings, read from ONBOARD_* environment variables (see .env.example)."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

SERVICE_DIR = Path(__file__).resolve().parents[1]
WORKSPACE_DIR = SERVICE_DIR.parent


class OnboardSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="ONBOARD_")

    # Default: the onboard-db container from docker-compose.yml, published on localhost:5433.
    database_url: str = "postgresql+psycopg://onboard:onboard@localhost:5433/onboard"
    crew_file: Path = WORKSPACE_DIR / "contracts" / "crew.json"
    # Wearable emulator on Vercel (SyncRequest / ReceiptAck).
    simulator_url: str = ""
    simulator_token: str = ""
    # Earth ingest, reached over the private Docker network.
    earth_url: str = "http://earth:8000"
    earth_ingest_token: str = ""
