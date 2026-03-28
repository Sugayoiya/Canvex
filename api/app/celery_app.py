from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "canvas_studio",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    result_expires=86400,  # 24h

    task_queues={
        "ai_generation": {"exchange": "ai_generation", "routing_key": "ai_generation"},
        "media_processing": {"exchange": "media_processing", "routing_key": "media_processing"},
        "pipeline": {"exchange": "pipeline", "routing_key": "pipeline"},
        "quick": {"exchange": "quick", "routing_key": "quick"},
    },
    task_default_queue="ai_generation",

    task_soft_time_limit=600,   # 10min default soft limit
    task_time_limit=660,        # 11min hard limit

    task_routes={
        "app.tasks.skill_task.run_skill_task": {"queue": "ai_generation"},
    },
)

celery_app.conf.include = ["app.tasks.skill_task"]
