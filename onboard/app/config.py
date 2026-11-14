"""Onboard settings, read from ONBOARD_* environment variables (see .env.example)."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

SERVICE_DIR = Path(__file__).resolve().parents[1]
WORKSPACE_DIR = SERVICE_DIR.parent


class OnboardSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="ONBOARD_")

    database_path: Path = SERVICE_DIR / "data" / "onboard.db"
    schema_dir: Path = SERVICE_DIR / "schema"
    crew_file: Path = WORKSPACE_DIR / "contracts" / "crew.json"
    # Wearable emulator on Vercel (SyncRequest / ReceiptAck).
    simulator_url: str = ""
    simulator_token: str = ""
    # Earth ingest, reached over the private Docker network.
    earth_url: str = "http://earth:8000"
    earth_ingest_token: str = ""
