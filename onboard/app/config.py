"""Onboard settings, read from ONBOARD_* environment variables (see .env.example)."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

SERVICE_DIR = Path(__file__).resolve().parents[1]
WORKSPACE_DIR = SERVICE_DIR.parent


class OnboardSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="ONBOARD_")

    # Default: the onboard-db container from docker-compose.yml, published on 127.0.0.1:5433.
    # Fixed IPv4 on purpose: "localhost" resolves to ::1 first on Windows and hangs
    # (nothing listens on IPv6). Containers use ONBOARD_DATABASE_URL instead.
    database_url: str = "postgresql+psycopg://onboard:onboard@127.0.0.1:5433/onboard"
    crew_file: Path = WORKSPACE_DIR / "contracts" / "crew.json"
    metrics_file: Path = WORKSPACE_DIR / "contracts" / "metrics.json"
    # Wearable emulator on Vercel (SyncRequest / ReceiptAck).
    simulator_url: str = ""
    simulator_token: str = ""
    # Earth ingest, reached over the private Docker network.
    earth_url: str = "http://earth:8000"
    earth_ingest_token: str = ""
