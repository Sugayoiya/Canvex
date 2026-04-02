"""Celery periodic task: sync Redis key health state to DB every 5 minutes."""

import asyncio
import logging

from app.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="health_sync.sync_key_health_to_db")
def sync_key_health_to_db_task():
    """Sync Redis health counters to PostgreSQL for crash recovery."""
    from app.services.ai.provider_manager import sync_health_to_db

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(sync_health_to_db())
    finally:
        loop.close()
