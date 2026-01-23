from __future__ import annotations

from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


# Caminho correto do .env
# backend/app/settings.py -> backend/.env
ENV_PATH = Path(__file__).resolve().parents[1] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ENV_PATH),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",  # IMPORTANTE: ignora qualquer coisa fora do modelo
    )

    # =====================
    # Database
    # =====================
    DATABASE_URL: str = Field(...)

    # =====================
    # JWT
    # =====================
    JWT_SECRET_KEY: str = Field(..., min_length=16)
    JWT_ALGORITHM: str = "HS256"

    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # =====================
    # Admin seed
    # =====================
    ADMIN_EMAIL: str | None = None
    ADMIN_PASSWORD: str | None = None
    ADMIN_NAME: str | None = "Admin"


settings = Settings()
