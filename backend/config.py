"""Application settings, loaded from environment variables (and an optional .env file)."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_name: str = "Route53 Clone API"
    app_version: str = "0.1.0"

    # Absolute path by default so the API and Alembic hit the same file regardless of cwd.
    database_url: str = f"sqlite:///{BACKEND_DIR / 'route53.db'}"

    # Comma-separated list of origins allowed to call the API directly from a browser.
    # The Next.js dev server proxies /api/* (same-origin), so this only matters for
    # direct cross-origin calls and deployed setups.
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Cached so the environment is read once per process."""
    return Settings()
