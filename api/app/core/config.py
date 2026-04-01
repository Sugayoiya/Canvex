import warnings

from pydantic_settings import BaseSettings

_INSECURE_DEFAULT_KEY = "your-secret-key-change-in-production"


class Settings(BaseSettings):
    PROJECT_NAME: str = "Canvex"
    API_V1_STR: str = "/api/v1"

    # Database
    USE_SQLITE: bool = True
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/canvas_studio"
    SQLITE_URL: str = "sqlite+aiosqlite:///./dev.db"

    @property
    def database_url(self) -> str:
        if self.USE_SQLITE:
            return self.SQLITE_URL
        return self.DATABASE_URL

    # Redis (required for Celery)
    REDIS_URL: str = "redis://localhost:6379/0"

    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # CORS
    BACKEND_CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # JWT
    SECRET_KEY: str = _INSECURE_DEFAULT_KEY
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # OAuth (optional)
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    FRONTEND_URL: str = "http://localhost:3000"

    # File Storage
    STORAGE_TYPE: str = "local"
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE: int = 500 * 1024 * 1024

    # AI Providers
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    DEEPSEEK_API_KEY: str = ""
    GROK_API_KEY: str = ""

    # Default admin
    DEFAULT_ADMIN_EMAIL: str = "admin@canvex.studio"
    DEFAULT_ADMIN_PASSWORD: str = "Admin123!"

    # Seed test data on startup (dev only)
    SEED_TEST_DATA: bool = False

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

if settings.SECRET_KEY == _INSECURE_DEFAULT_KEY:
    warnings.warn(
        "SECRET_KEY is using the insecure default value! "
        "Set a strong random SECRET_KEY in .env before deploying to production.",
        stacklevel=1,
    )
