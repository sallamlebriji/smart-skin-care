from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central app config, read from environment / .env (see .env.example)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./data/smartskin.db"

    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 30

    storage_endpoint_url: str = ""
    storage_bucket: str = "smart-skin-care-scans"
    storage_access_key: str = ""
    storage_secret_key: str = ""

    debug: bool = True
    scan_storage_dir: str = "data/scans"
    max_upload_bytes: int = 5_000_000
    openai_api_key: str = ""
    openai_model: str = "gpt-4.1-mini"
    warm_model_on_startup: bool = False
    model_registry_dir: str = "data/models"

    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
