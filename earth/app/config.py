"""Earth settings, read from EARTH_* environment variables (see .env.example)."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class EarthSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="EARTH_")

    # Default: the earth-db container from docker-compose.yml, published on 127.0.0.1:5434.
    # Fixed IPv4 on purpose: "localhost" resolves to ::1 first on Windows and hangs.
    database_url: str = "postgresql+psycopg://earth:earth@127.0.0.1:5434/earth"
    # Bearer token onboard must send to the ingest endpoint.
    ingest_token: str = ""
