"""Earth settings, read from EARTH_* environment variables (see .env.example)."""

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

SERVICE_DIR = Path(__file__).resolve().parents[1]
WORKSPACE_DIR = SERVICE_DIR.parent


class EarthSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="EARTH_")

    # Default: the earth-db container from docker-compose.yml, published on 127.0.0.1:5434.
    # Fixed IPv4 on purpose: "localhost" resolves to ::1 first on Windows and hangs.
    database_url: str = "postgresql+psycopg://earth:earth@127.0.0.1:5434/earth"
    # Bearer token onboard must send to the ingest endpoint.
    ingest_token: str = ""
    # Roster for the Earth view (crew members without data show as MISSING).
    crew_file: Path = WORKSPACE_DIR / "contracts" / "crew.json"
    # Data older than this shows as STALE. Default 10 min: readings arrive about a minute
    # late in normal operation (emulator sync + Outbox), so 10 min means something is wrong.
    stale_after_ms: int = Field(default=600_000, gt=0)
