"""
CredentialCache — Redis credential resolution cache with metadata-only storage.

Caches key selection metadata (key_id, config_id, provider_name) — never decrypted API keys.
On cache hit the caller does a single-row DB lookup by key_id to decrypt.
Includes single-flight lock to prevent stampede on TTL expiry and graceful degradation.
"""

import json
import random
import logging
from typing import Any

import redis.asyncio as aioredis
from redis.exceptions import (
    ConnectionError as RedisConnectionError,
    TimeoutError as RedisTimeoutError,
    RedisError,
)

from app.core.config import settings

logger = logging.getLogger(__name__)

CRED_CACHE_TTL = 60  # seconds (base)
CRED_CACHE_JITTER = 5  # ±5s → actual TTL 55-65s
LOCK_TTL = 5  # seconds for single-flight lock


class CredentialCache:
    """Redis credential resolution cache storing only key selection metadata (no raw keys)."""

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

    async def get_cached(
        self, provider: str, owner_chain: list[tuple[str, str | None]]
    ) -> dict | None:
        """Check cache for each level in the credential chain. Returns metadata or None."""
        try:
            r = await self._get_redis()
            for owner_type, owner_id in owner_chain:
                cache_key = f"canvex:cred:{provider}:{owner_type}:{owner_id or 'system'}"
                data = await r.get(cache_key)
                if data:
                    logger.debug("cred_cache_hit provider=%s owner_type=%s", provider, owner_type)
                    return json.loads(data)
            logger.debug("cred_cache_miss provider=%s", provider)
            return None
        except (RedisConnectionError, RedisTimeoutError, RedisError) as e:
            logger.warning("redis_degraded_get_cached provider=%s error=%s", provider, e)
            return None

    async def set_cached(
        self,
        provider: str,
        owner_type: str,
        owner_id: str | None,
        value: dict,
    ) -> None:
        """Store key selection metadata with jittered TTL. Value must NOT contain decrypted keys."""
        try:
            r = await self._get_redis()
            cache_key = f"canvex:cred:{provider}:{owner_type}:{owner_id or 'system'}"
            ttl = CRED_CACHE_TTL + random.randint(-CRED_CACHE_JITTER, CRED_CACHE_JITTER)
            await r.setex(cache_key, ttl, json.dumps(value))
            logger.debug("cred_cache_set provider=%s owner_type=%s ttl=%d", provider, owner_type, ttl)
        except (RedisConnectionError, RedisTimeoutError, RedisError) as e:
            logger.warning("redis_degraded_set_cached provider=%s error=%s", provider, e)

    async def acquire_populate_lock(
        self, provider: str, owner_type: str, owner_id: str | None
    ) -> bool:
        """Acquire single-flight SET NX lock to prevent stampede on cache miss."""
        try:
            r = await self._get_redis()
            lock_key = f"canvex:cred_lock:{provider}:{owner_type}:{owner_id or 'system'}"
            acquired = await r.set(lock_key, "1", ex=LOCK_TTL, nx=True)
            if acquired:
                logger.debug("cred_cache_lock_acquired provider=%s owner_type=%s", provider, owner_type)
            return bool(acquired)
        except (RedisConnectionError, RedisTimeoutError, RedisError):
            return True  # degrade to no-lock: allow population

    async def release_populate_lock(
        self, provider: str, owner_type: str, owner_id: str | None
    ) -> None:
        """Release single-flight lock. Lock auto-expires via TTL if release fails."""
        try:
            r = await self._get_redis()
            lock_key = f"canvex:cred_lock:{provider}:{owner_type}:{owner_id or 'system'}"
            await r.delete(lock_key)
        except (RedisConnectionError, RedisTimeoutError, RedisError):
            pass  # lock will auto-expire via TTL

    async def invalidate(
        self, provider: str, owner_type: str | None = None, owner_id: str | None = None
    ) -> None:
        """Invalidate cached credentials. Specific key if owner_type given, else SCAN all for provider."""
        try:
            r = await self._get_redis()
            if owner_type:
                cache_key = f"canvex:cred:{provider}:{owner_type}:{owner_id or 'system'}"
                await r.delete(cache_key)
            else:
                pattern = f"canvex:cred:{provider}:*"
                cursor: int = 0
                while True:
                    cursor, keys = await r.scan(cursor, match=pattern, count=100)
                    if keys:
                        await r.delete(*keys)
                    if cursor == 0:
                        break
            logger.info("cred_cache_invalidated provider=%s owner_type=%s", provider, owner_type)
        except (RedisConnectionError, RedisTimeoutError, RedisError) as e:
            logger.warning("redis_degraded_invalidate provider=%s error=%s", provider, e)


_cache: CredentialCache | None = None


def get_credential_cache() -> CredentialCache:
    global _cache
    if _cache is None:
        _cache = CredentialCache()
    return _cache
