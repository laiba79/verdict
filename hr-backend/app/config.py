"""
Centralized app configuration.

Everything environment-specific (secrets, DB location, token lifetime,
allowed frontend origins) lives here and is read from a `.env` file.
This means you never hardcode secrets in code, and you can point the
same codebase at a different database or frontend just by editing `.env`.
"""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    SECRET_KEY: str = "dev-only-secret-change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    DATABASE_URL: str = "sqlite:///./hr_decision_system.db"

    FIRST_ADMIN_EMAIL: str = "admin@example.com"
    FIRST_ADMIN_PASSWORD: str = "ChangeMe123!"

    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    MODELS_DIR: str = "outputs/models"

    # Free LLM provider (console.groq.com) used to power the in-app HR
    # assistant chatbot. Left blank, the chatbot endpoint returns a clear
    # 503 instead of failing mysteriously -- the app runs fine without it.
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    # Applied to current_salary when an "increase"/"decrease" salary_change
    # prediction is approved (e.g. 0.10 == a 10% raise/cut). The model only
    # predicts a direction/category, not a dollar amount, so this is the
    # policy knob that turns "increase" into an actual number.
    SALARY_INCREASE_PCT: float = 0.10
    SALARY_DECREASE_PCT: float = 0.05

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    # lru_cache -> settings are parsed from .env once and reused everywhere,
    # instead of re-reading the file on every request.
    return Settings()
