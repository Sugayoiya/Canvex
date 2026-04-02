"""
KeyHealthManager — Redis-backed per-key health state with atomic ops and degraded fallback.

Provides CRUD for key health metrics (error_count, last_used_at, recent errors, usage trend).
All Redis operations degrade gracefully when Redis is unavailable.
Error messages are redacted before storage to prevent credential leakage.
"""

import json
import re
import logging
from datetime import datetime, timezone, timedelta
from typing import Any

import redis.asyncio as aioredis
from redis.exceptions import (
    ConnectionError as RedisConnectionError,
    TimeoutError as RedisTimeoutError,
    RedisError,
)

from app.core.config import settings

logger = logging.getLogger(__name__)

MAX_KEY_ERRORS = 5

_SENSITIVE_PATTERNS = [
    re.compile(r"(sk-[a-zA-Z0-9]{20,})"),
    re.compile(r"(AIza[a-zA-Z0-9_-]{35,})"),
    re.compile(r"(Bearer\s+[a-zA-Z0-9._-]{20,})"),
    re.compile(r"(api[_-]?key[=:]\s*\S{10,})", re.IGNORECASE),
    re.compile(r"(https?://[^@\s]*:[^@\s]*@)"),
]


def _redact_error_message(message: str, max_length: int = 200) -> str:
    """Strip sensitive patterns (API keys, tokens, URLs with creds) before Redis storage."""
    redacted = message
    for pattern in _SENSITIVE_PATTERNS:
        redacted = pattern.sub("[REDACTED]", redacted)
    return redacted[:max_length]


class KeyHealthManager:
    """Redis CRUD for per-key health state with atomic pipelines and degraded fallback."""

    def __init__(self) -> None:
        self._redis: aioredis.Redis | None = None

    async def _get_redis(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(
                settings.REDIS_URL, decode_responses=True
            )
        return self._redis

    async def close(self) -> None:
        if self._redis is not None:
            await self._redis.close()
            self._redis = None

    async def get_health(self, key_id: str) -> dict:
        """Return health state for a key. Safe defaults when Redis is down."""
        try:
            r = await self._get_redis()
            data = await r.hgetall(f"canvex:key_health:{key_id}")
            error_count = int(data.get("error_count", 0))
            return {
                "error_count": error_count,
                "last_used_at": data.get("last_used_at"),
                "last_error_type": data.get("last_error_type"),
                "is_healthy": error_count < MAX_KEY_ERRORS,
            }
        except (RedisConnectionError, RedisTimeoutError, RedisError) as e:
            logger.warning("redis_degraded_get_health key_id=%s error=%s", key_id, e)
            return {
                "error_count": 0,
                "last_used_at": None,
                "last_error_type": None,
                "is_healthy": True,
            }

    async def report_success(self, key_id: str) -> None:
        """Record a successful API call. No-op when Redis is down."""
        try:
            r = await self._get_redis()
            now = datetime.now(timezone.utc).isoformat()
            hour_key = (
                f"canvex:key_usage:{key_id}"
                f":{datetime.now(timezone.utc).strftime('%Y%m%d%H')}"
            )
            pipe = r.pipeline()
            pipe.hset(f"canvex:key_health:{key_id}", "last_used_at", now)
            pipe.incr(hour_key)
            pipe.expire(hour_key, 604800)
            await pipe.execute()
            logger.debug("key_health_success key_id=%s", key_id)
        except (RedisConnectionError, RedisTimeoutError, RedisError) as e:
            logger.warning("redis_degraded_report_success key_id=%s error=%s", key_id, e)

    async def report_error(
        self, key_id: str, error_type: str, error_message: str
    ) -> None:
        """Record an API error atomically. Redacts message before storage. No-op when Redis is down."""
        try:
            r = await self._get_redis()
            now = datetime.now(timezone.utc).isoformat()
            redacted_msg = _redact_error_message(error_message)
            error_entry = json.dumps(
                {"type": error_type, "message": redacted_msg, "at": now}
            )
            pipe = r.pipeline()
            pipe.hincrby(f"canvex:key_health:{key_id}", "error_count", 1)
            pipe.hset(
                f"canvex:key_health:{key_id}",
                mapping={
                    "last_used_at": now,
                    "last_error_type": error_type,
                    "last_error_at": now,
                },
            )
            pipe.lpush(f"canvex:key_errors:{key_id}", error_entry)
            pipe.ltrim(f"canvex:key_errors:{key_id}", 0, 19)
            await pipe.execute()
            logger.info("key_health_error_reported key_id=%s error_type=%s", key_id, error_type)
        except (RedisConnectionError, RedisTimeoutError, RedisError) as e:
            logger.warning("redis_degraded_report_error key_id=%s error=%s", key_id, e)

    async def reset_error_count(self, key_id: str) -> None:
        """Reset error count and clear recent errors for a key."""
        try:
            r = await self._get_redis()
            pipe = r.pipeline()
            pipe.hset(f"canvex:key_health:{key_id}", "error_count", 0)
            pipe.delete(f"canvex:key_errors:{key_id}")
            await pipe.execute()
        except (RedisConnectionError, RedisTimeoutError, RedisError) as e:
            logger.warning("redis_degraded_reset_errors key_id=%s error=%s", key_id, e)

    async def set_health(self, key_id: str, data: dict) -> None:
        """Bulk-set health fields from dict (used by startup DB restore). No-op on Redis error."""
        try:
            r = await self._get_redis()
            if data:
                await r.hset(f"canvex:key_health:{key_id}", mapping={
                    k: str(v) for k, v in data.items() if v is not None
                })
        except (RedisConnectionError, RedisTimeoutError, RedisError) as e:
            logger.warning("redis_degraded_set_health key_id=%s error=%s", key_id, e)

    async def get_recent_errors(self, key_id: str, limit: int = 20) -> list[dict]:
        """Return recent error entries (newest first). Empty list on Redis error."""
        try:
            r = await self._get_redis()
            raw = await r.lrange(f"canvex:key_errors:{key_id}", 0, limit - 1)
            return [json.loads(entry) for entry in raw]
        except (RedisConnectionError, RedisTimeoutError, RedisError) as e:
            logger.warning("redis_degraded_get_recent_errors key_id=%s error=%s", key_id, e)
            return []

    async def get_usage_trend(self, key_id: str, hours: int = 24) -> list[dict]:
        """Return hourly usage counters for the last N hours. Empty list on Redis error."""
        try:
            r = await self._get_redis()
            now = datetime.now(timezone.utc)
            hour_keys = []
            labels = []
            for i in range(hours):
                t = now - timedelta(hours=hours - 1 - i)
                label = t.strftime("%Y%m%d%H")
                labels.append(label)
                hour_keys.append(f"canvex:key_usage:{key_id}:{label}")

            pipe = r.pipeline()
            for hk in hour_keys:
                pipe.get(hk)
            values = await pipe.execute()

            return [
                {"hour": labels[i], "count": int(values[i] or 0)}
                for i in range(hours)
            ]
        except (RedisConnectionError, RedisTimeoutError, RedisError) as e:
            logger.warning("redis_degraded_get_usage_trend key_id=%s error=%s", key_id, e)
            return []


_manager: KeyHealthManager | None = None


def get_key_health_manager() -> KeyHealthManager:
    global _manager
    if _manager is None:
        _manager = KeyHealthManager()
    return _manager
