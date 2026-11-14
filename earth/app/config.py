"""Earth settings, read from EARTH_* environment variables (see .env.example)."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

SERVICE_DIR = Path(__file__).resolve().parents[1]


class EarthSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="EARTH_")

    database_path: Path = SERVICE_DIR / "data" / "earth.db"
    schema_dir: Path = SERVICE_DIR / "schema"
    # Bearer token onboard must send to the ingest endpoint.
    ingest_token: str = ""
