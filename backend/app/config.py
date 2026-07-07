from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+psycopg2://pr_dashboard:pr_dashboard@localhost:5432/pr_dashboard"
    token_encryption_key: str = ""
    # Any installed Chrome extension is served from its own chrome-extension://<id> origin,
    # so an exact-match allowlist can't work here — match the scheme via regex instead.
    cors_allow_origin_regex: str = r"^chrome-extension://.*$"


@lru_cache
def get_settings() -> Settings:
    return Settings()
