import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from app.core.config import settings
from app.core.rate_limit import limiter
from app.core.structured_logging import setup_logging

setup_logging(log_level="INFO", json_file="logs/app.jsonl")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting %s ...", settings.PROJECT_NAME)

    # Initialize database
    from app.core.database import init_db
    await init_db()

    # Seed env-var API keys into DB + restore Redis health state from DB
    from app.services.ai.provider_manager import (
        seed_providers_from_env, restore_health_from_db, sync_health_to_db,
    )
    from app.services.ai.key_health import get_key_health_manager
    from app.services.ai.credential_cache import get_credential_cache

    await seed_providers_from_env()
    await restore_health_from_db()

    # Register all Skills
    from app.skills.register_all import register_all_skills
    register_all_skills()

    logger.info("%s is ready", settings.PROJECT_NAME)
    yield
    logger.info("%s shutting down", settings.PROJECT_NAME)

    # Graceful shutdown: sync Redis health to DB, close Redis connections
    await sync_health_to_db()
    await get_key_health_manager().close()
    await get_credential_cache().close()


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    lifespan=lifespan,
)

# Rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count"],
)

# Trace ID middleware
from app.core.middleware import TraceIdMiddleware  # noqa: E402
app.add_middleware(TraceIdMiddleware)

# API routes
from app.api.v1.router import api_router  # noqa: E402
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health")
async def health():
    from app.skills.registry import skill_registry
    return {
        "status": "ok",
        "project": settings.PROJECT_NAME,
        "skills_registered": skill_registry.skill_count,
    }
