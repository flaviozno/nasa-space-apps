"""Earth settings, read from EARTH_* environment variables (see .env.example)."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class EarthSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="EARTH_")

    # Default: the earth-db container from docker-compose.yml, published on localhost:5434.
    database_url: str = "postgresql+psycopg://earth:earth@localhost:5434/earth"
    # Bearer token onboard must send to the ingest endpoint.
    ingest_token: str = ""
