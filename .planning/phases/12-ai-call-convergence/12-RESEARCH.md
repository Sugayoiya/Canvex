# Phase 12: AI Call Convergence - Research

**Researched:** 2026-04-02
**Domain:** AI provider credential resolution, key rotation, Redis health caching, admin UI
**Confidence:** HIGH

## Summary

Phase 12 converges three separate AI call stacks into a single unified `ProviderManager.get_provider()` async DB path. The existing codebase is ~70% ready: `get_provider()` with full DB credential chain, `KeyRotator` with round-robin/error-skip, Fernet encryption, and `seed_providers_from_env()` all exist as working-but-inactive code. The primary work is: (1) backing KeyRotator health state with Redis instead of in-memory, (2) adding Redis credential resolution caching with active invalidation, (3) migrating 13 call sites from sync/direct-settings reads to the unified async path, (4) adding health feedback hooks to the error taxonomy, and (5) extending the admin provider UI with per-key health display.

Redis 6.4.0 (`redis.asyncio`) is already installed via `celery[redis]`. PydanticAI 1.73.0 supports explicit `api_key` injection via `GoogleProvider`/`OpenAIProvider`. Celery workers already use `loop.run_until_complete()` for async handlers. SkillContext already carries `team_id` + `user_id` for credential chain resolution.

**Primary recommendation:** Activate existing dead code, back KeyRotator with Redis, migrate call sites incrementally by stack (LLM skills → Agent → Image/Video), and extend admin UI with health badges.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** All AI callers (Agent/PydanticAI, LLM Skills, Image/Video Skills, Celery Workers) resolve credentials through a single async `get_provider()` DB chain: team → personal → system → error (no env fallback at runtime)
- **D-02:** Environment variable keys are seed-only — `seed_providers_from_env()` writes them to DB on first startup; runtime never reads env vars for API keys
- **D-03:** Fully async unified path — one `get_provider()` implementation. Celery workers call it via `asyncio.run()`. No separate sync code path to maintain
- **D-04:** PydanticAI Agent resolves key from DB via `get_provider()` each time `create_agent()` / `create_pydantic_model()` is called — always uses latest key state
- **D-05:** Credential resolution results cached in Redis with short TTL (~60s). Admin key changes (disable/modify/delete) actively invalidate the cache for immediate effect
- **D-06:** Key health state (error_count, last_used_at, usage stats) stored in Redis as hot cache — shared across all Web processes and Celery workers
- **D-07:** KeyRotator reads Redis for real-time health decisions (round-robin across healthy keys, skip keys with error_count >= threshold)
- **D-08:** On AI call failure (429/5xx): increment error_count in Redis immediately, auto-retry with next healthy key from rotation pool (CONV-09)
- **D-09:** On AI call success: update last_used_at in Redis
- **D-10:** Background sync from Redis to DB periodically (for Admin UI display and restart recovery)
- **D-11:** On service restart: restore Redis health state from DB
- **D-13:** Detailed mode — each key displays: health badge (green/yellow/red), error_count, last_used_at, recent error history (last N errors with timestamp + error type), usage frequency trend
- **D-14:** Key-level operations: enable/disable toggle, reset error count button
- **D-15:** Uses existing Admin Provider page as base, extends with health information per key
- **D-16:** Drop SQLite support — enforce PostgreSQL only

### Claude's Discretion
- D-12: Migration strategy (incremental vs big bang, feature flags)
- Redis key naming scheme and TTL values
- Health badge thresholds (what error_count maps to green/yellow/red)
- Error history storage depth (how many recent errors to keep)
- Usage frequency trend visualization approach (chart type, time window)
- DB sync interval from Redis
- `get_provider_sync()` deprecation/removal timeline

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CONV-01 | All LLM skill invocations resolve API keys through unified ProviderManager async path | 10 skill call sites identified; all use identical `get_provider_sync()` pattern, swap to `get_provider()` |
| CONV-02 | PydanticAI Agent model construction uses unified ProviderManager | `create_pydantic_model()` in `agent_service.py` reads settings directly; replace with `get_provider()` + PydanticAI provider injection |
| CONV-03 | Image generation skills resolve credentials through unified ProviderManager | `generate_image.py` reads `settings.GEMINI_API_KEY`; replace with `get_provider()` for gemini key resolution |
| CONV-04 | Video generation skills resolve credentials through unified ProviderManager | `generate_video.py` reads `settings.GEMINI_API_KEY`; replace with `get_provider()` for gemini key resolution |
| CONV-05 | Dead code `ProviderManager.get_provider()` activated and tested | Full async implementation exists at lines 150-284 of `provider_manager.py`; needs Redis backing + env fallback removal |
| CONV-06 | Existing 14 skills work without behavior changes | Incremental migration with integration test coverage per skill |
| CONV-07 | KeyRotator round-robin activated with multiple keys | `KeyRotator` class exists with round-robin logic; needs Redis-backed health reads instead of in-memory |
| CONV-08 | KeyRotator error feedback loop — 429/5xx increments error_count, unhealthy keys skipped | Existing `report_error()` invalidates pools; extend to write Redis + integrate with `LLMProviderBase` retry wrapper |
| CONV-09 | Auto-retry on key failure with next healthy key | Integrate retry-with-rotation into the `LLMProviderBase.__init_subclass__` wrapper and image/video providers |
| CONV-10 | Admin API supports per-key management — enable/disable, reset error_count, configure rate_limit_rpm | Existing CRUD in `ai_providers.py`; add PATCH endpoint for key-level operations + health read from Redis |
| CONV-11 | Admin provider page shows per-key health status with key-level operations | Existing `provider-card.tsx` with key table; extend KeyRow with health badges + action buttons |
</phase_requirements>

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| redis (redis-py) | 6.4.0 (installed) | Async Redis client for health cache + credential cache | Already installed via `celery[redis]`; `redis.asyncio` module provides full async API |
| SQLAlchemy | 2.0.46+ (installed) | Async DB for credential chain resolution | Already the project ORM; async sessions via `AsyncSessionLocal` |
| PydanticAI | 1.73.0 (installed) | Agent model construction with explicit api_key | `GoogleModel`/`OpenAIModel` accept `provider=GoogleProvider(api_key=...)` |
| Celery | 5.4.0+ (installed) | Async task execution in workers | Workers already use `loop.run_until_complete()` for async handlers |
| cryptography (Fernet) | installed | API key encryption/decryption | `encrypt_api_key()` / `_decrypt_key()` already implemented |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| structlog | 24.4.0 (installed) | Structured logging in Celery workers | Already used in `skill_task.py` for contextvars binding |

### No New Dependencies Required
All libraries needed are already in `pyproject.toml`. No new packages need to be installed.

## Architecture Patterns

### Recommended Module Structure
```
api/app/services/ai/
├── provider_manager.py   # ProviderManager (modify existing — Redis-backed)
├── key_health.py         # NEW: KeyHealthManager (Redis health state CRUD)
├── credential_cache.py   # NEW: CredentialCache (Redis cache with TTL + invalidation)
├── base.py               # AIProviderBase (unchanged)
├── llm_provider_base.py  # LLMProviderBase (extend retry wrapper with key rotation)
├── errors.py             # Error taxonomy (unchanged)
└── ...
```

### Pattern 1: Redis-Backed Key Health Manager
**What:** Centralized Redis manager for per-key health state (error_count, last_used_at, recent errors)
**When to use:** Every AI call reads health before selecting key; every AI call result updates health

```python
# Key naming scheme
# provider_key:health:{key_id} — Hash: error_count, last_used_at, last_error_type, last_error_at
# provider_key:errors:{key_id} — List: recent error entries (capped to N entries)
# provider_key:usage:{key_id}:{hour} — Counter: requests per hour (for trend)

import redis.asyncio as aioredis
from app.core.config import settings

class KeyHealthManager:
    def __init__(self):
        self._redis: aioredis.Redis | None = None

    async def _get_redis(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        return self._redis

    async def get_health(self, key_id: str) -> dict:
        r = await self._get_redis()
        data = await r.hgetall(f"provider_key:health:{key_id}")
        return {
            "error_count": int(data.get("error_count", 0)),
            "last_used_at": data.get("last_used_at"),
            "last_error_type": data.get("last_error_type"),
            "is_healthy": int(data.get("error_count", 0)) < MAX_KEY_ERRORS,
        }

    async def report_success(self, key_id: str):
        r = await self._get_redis()
        now = datetime.utcnow().isoformat()
        await r.hset(f"provider_key:health:{key_id}", mapping={
            "last_used_at": now,
        })
        hour_key = f"provider_key:usage:{key_id}:{datetime.utcnow().strftime('%Y%m%d%H')}"
        await r.incr(hour_key)
        await r.expire(hour_key, 86400 * 7)  # keep 7 days of hourly stats

    async def report_error(self, key_id: str, error_type: str, error_message: str):
        r = await self._get_redis()
        now = datetime.utcnow().isoformat()
        pipe = r.pipeline()
        pipe.hincrby(f"provider_key:health:{key_id}", "error_count", 1)
        pipe.hset(f"provider_key:health:{key_id}", mapping={
            "last_used_at": now,
            "last_error_type": error_type,
            "last_error_at": now,
        })
        error_entry = json.dumps({"type": error_type, "message": error_message[:200], "at": now})
        pipe.lpush(f"provider_key:errors:{key_id}", error_entry)
        pipe.ltrim(f"provider_key:errors:{key_id}", 0, 19)  # keep last 20 errors
        await pipe.execute()

    async def reset_error_count(self, key_id: str):
        r = await self._get_redis()
        await r.hset(f"provider_key:health:{key_id}", "error_count", 0)
        await r.delete(f"provider_key:errors:{key_id}")
```

### Pattern 2: Credential Resolution Cache
**What:** Redis cache for resolved credentials to avoid DB round-trip on every AI call
**When to use:** Every `get_provider()` call checks cache first

```python
# Key: cred_cache:{provider}:{owner_type}:{owner_id_or_system}
# Value: JSON with encrypted_key, key_id, config_id
# TTL: 60 seconds
# Invalidation: Admin operations delete matching cache keys

CRED_CACHE_TTL = 60  # seconds

class CredentialCache:
    async def get_cached(self, provider: str, owner_chain: list[tuple[str, str|None]]) -> tuple | None:
        """Check Redis cache for each level in the credential chain."""
        r = await self._get_redis()
        for owner_type, owner_id in owner_chain:
            cache_key = f"cred_cache:{provider}:{owner_type}:{owner_id or 'system'}"
            data = await r.get(cache_key)
            if data:
                return json.loads(data)
        return None

    async def set_cached(self, provider: str, owner_type: str, owner_id: str | None, value: dict):
        r = await self._get_redis()
        cache_key = f"cred_cache:{provider}:{owner_type}:{owner_id or 'system'}"
        await r.setex(cache_key, CRED_CACHE_TTL, json.dumps(value))

    async def invalidate(self, provider: str, owner_type: str, owner_id: str | None):
        """Called by admin API on key changes."""
        r = await self._get_redis()
        pattern = f"cred_cache:{provider}:{owner_type}:{owner_id or 'system'}"
        await r.delete(pattern)
```

### Pattern 3: Unified get_provider() with Retry-on-Key-Failure
**What:** Modified `get_provider()` that integrates health-aware key selection + retry with next key on 429/5xx
**When to use:** All AI calls go through this path

```python
async def get_provider(self, provider: str, model: str | None = None,
                       *, team_id: str | None = None, user_id: str | None = None,
                       db: AsyncSession | None = None) -> tuple[AIProviderBase, str, str]:
    """Returns (provider_instance, owner_desc, key_id) for health reporting."""
    # 1. Check credential cache in Redis
    # 2. If cache miss, resolve via DB chain (team → personal → system)
    # 3. Use KeyRotator with Redis-backed health to select key
    # 4. Cache resolved credential
    # 5. Return provider instance + key_id for caller to report success/error
```

### Pattern 4: Migration Wrapper for Skills
**What:** Since all 10 LLM skills follow an identical pattern, create a helper function
**When to use:** Replaces `get_provider_sync()` calls across all skills

```python
# In provider_manager.py or a new utility
async def resolve_llm_provider(
    provider_name: str = "gemini",
    model_name: str | None = None,
    ctx: SkillContext | None = None,
) -> AIProviderBase:
    """Convenience wrapper for skill handlers — resolves via unified async path."""
    pm = get_provider_manager()
    team_id = ctx.team_id if ctx else None
    user_id = ctx.user_id if ctx else None
    provider_instance, _owner, _key_id = await pm.get_provider(
        provider_name, model=model_name,
        team_id=team_id, user_id=user_id,
    )
    return provider_instance
```

### Pattern 5: Celery Worker Async Bridge (Already Established)
**What:** Celery workers use `loop.run_until_complete()` to call async code
**When to use:** Already used in `skill_task.py` — no change needed

```python
# Existing pattern in skill_task.py line 79-82
loop = _get_or_create_event_loop()
result = loop.run_until_complete(handler(params, ctx))
```

Since skill handlers are already async and executed via this bridge, switching from `get_provider_sync()` to `await get_provider()` inside handlers requires zero changes to the Celery task infrastructure.

### Pattern 6: Background Redis→DB Sync
**What:** Periodic task syncs health state from Redis to PostgreSQL for persistence
**When to use:** Celery beat schedule or FastAPI background task

```python
# Option A: Celery beat periodic task
@celery_app.task(name="app.tasks.sync_key_health")
def sync_key_health_to_db():
    loop = _get_or_create_event_loop()
    loop.run_until_complete(_sync_health())

async def _sync_health():
    """Read all key health from Redis, write to AIProviderKey rows."""
    async with AsyncSessionLocal() as db:
        keys = (await db.execute(select(AIProviderKey))).scalars().all()
        for key in keys:
            health = await key_health_manager.get_health(key.id)
            key.error_count = health["error_count"]
            key.last_used_at = parse_datetime(health.get("last_used_at"))
        await db.commit()

# Option B: FastAPI startup lifespan with asyncio.create_task + sleep loop
# Simpler, runs in the web process, but doesn't survive process restart
```

### Anti-Patterns to Avoid
- **Dual sync/async code paths:** D-03 explicitly forbids maintaining `get_provider_sync()`. Remove it after migration.
- **In-memory health state:** D-06 requires Redis backing for cross-process sharing. Don't keep health in Python dicts.
- **Direct settings reads for API keys at runtime:** D-02 makes env vars seed-only. After `seed_providers_from_env()` runs, no code should read `settings.*_API_KEY`.
- **Cache without invalidation:** D-05 requires admin changes to take immediate effect. Always invalidate Redis cache on admin mutations.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Async Redis client | Custom socket wrapper | `redis.asyncio` (redis-py 6.4.0) | Already installed, battle-tested, full async API |
| Key rotation algorithm | Custom load balancer | Existing `KeyRotator` class + Redis health | Already implemented; just needs Redis backing |
| Credential encryption | Custom AES wrapper | Existing `encrypt_api_key()` / `_decrypt_key()` with Fernet | Already battle-tested in production |
| API key seeding | Manual DB inserts | Existing `seed_providers_from_env()` | Already handles env→DB conversion |
| PydanticAI model construction | Custom model wrapper | `GoogleModel(name, provider=GoogleProvider(api_key=...))` | PydanticAI 1.73.0 native API |
| Background sync scheduler | Custom threading | Celery beat periodic task | Already configured with Celery |

## Common Pitfalls

### Pitfall 1: Celery Worker Event Loop Leaks
**What goes wrong:** Creating a new event loop per task without proper cleanup causes resource leaks in long-running workers.
**Why it happens:** `asyncio.new_event_loop()` creates resources; if you `loop.close()` each time, you lose connection pools.
**How to avoid:** Reuse the existing `_get_or_create_event_loop()` pattern already in `skill_task.py` — it creates once and reuses.
**Warning signs:** Worker memory growing over time, "Event loop is closed" errors.

### Pitfall 2: Redis Connection Pool Exhaustion
**What goes wrong:** Creating a new `redis.asyncio.Redis` instance per call exhausts the connection pool.
**Why it happens:** Each `from_url()` creates a connection pool; hundreds of concurrent calls = hundreds of pools.
**How to avoid:** Use a singleton `KeyHealthManager` + `CredentialCache` with a single `Redis` instance. Initialize once, reuse.
**Warning signs:** Redis `maxclients` errors, "Connection refused" under load.

### Pitfall 3: Cache Stampede on Expiry
**What goes wrong:** Many concurrent requests all find an expired cache key and all hit the DB simultaneously.
**Why it happens:** 60s TTL expires, 50 concurrent AI calls all miss cache at once.
**How to avoid:** Use Redis `SET ... NX` pattern for cache population (only first request populates), or add jitter to TTL (55-65s random).
**Warning signs:** DB connection pool spikes every ~60 seconds.

### Pitfall 4: Race Condition in Key Disable + Active Request
**What goes wrong:** Admin disables a key while an active request is using it; next retry picks the same (now-disabled) key.
**Why it happens:** KeyRotator caches active key list; admin change isn't reflected until next health check.
**How to avoid:** Admin disable writes to Redis immediately (D-05); KeyRotator reads health from Redis on every rotation, not from cached state.
**Warning signs:** Requests fail with disabled key credentials after admin action.

### Pitfall 5: Image/Video Providers Don't Inherit LLMProviderBase Retry Wrapper
**What goes wrong:** `GeminiImageProvider` and `GeminiVideoProvider` don't extend `LLMProviderBase`, so they miss the `__init_subclass__` auto-retry wrapper.
**Why it happens:** Image/Video providers inherit nothing (standalone classes), not `LLMProviderBase`.
**How to avoid:** Add explicit retry-with-rotation logic to image/video skill handlers, or create an `ImageProviderBase` / `MediaProviderBase` with similar wrapping. Alternatively, handle retry at the skill handler level.
**Warning signs:** Image/Video generation fails on 429 without retry.

### Pitfall 6: Env Fallback Removal Breaks First-Time Setup
**What goes wrong:** Removing env fallback means first startup with env vars but no DB seeding = no working providers.
**Why it happens:** `seed_providers_from_env()` must run before any AI call. If startup order is wrong, get_provider() fails.
**How to avoid:** Ensure `seed_providers_from_env()` is called in FastAPI `lifespan` startup AND in Celery worker `worker_init` signal, before any AI call is possible.
**Warning signs:** "No API key configured for provider X" errors on fresh deployment.

### Pitfall 7: PydanticAI create_pydantic_model Becomes Async
**What goes wrong:** `create_pydantic_model()` is currently sync; making it async cascades to `create_agent()` and its callers.
**Why it happens:** DB credential resolution requires `await`; PydanticAI model construction itself is sync.
**How to avoid:** Split into two steps: (1) `await get_provider()` to resolve credentials, (2) sync PydanticAI model construction. Only step 1 is async. `create_pydantic_model()` can stay sync if you pass the resolved `api_key` as a parameter.
**Warning signs:** TypeError: `create_agent()` was never awaited.

## Code Examples

### Example 1: Migrating a LLM Skill (text.llm_generate pattern)

Before (current):
```python
from app.services.ai.provider_manager import get_provider_manager
provider = get_provider_manager().get_provider_sync(provider_name, model=model_name)
result_text = await provider.generate(messages, max_tokens=max_tokens)
```

After (unified async):
```python
from app.services.ai.provider_manager import get_provider_manager
pm = get_provider_manager()
provider, _owner, key_id = await pm.get_provider(
    provider_name, model=model_name,
    team_id=ctx.team_id, user_id=ctx.user_id,
)
result_text = await provider.generate(messages, max_tokens=max_tokens)
# Health reporting happens in LLMProviderBase wrapper (auto)
```

### Example 2: Migrating create_pydantic_model (Agent Stack A)

Before:
```python
def create_pydantic_model(provider: str, model_name: str):
    if provider == "gemini":
        key = settings.GEMINI_API_KEY
        return GoogleModel(model_name, provider=GoogleProvider(api_key=key))
```

After:
```python
async def resolve_pydantic_model(provider: str, model_name: str,
                                  *, team_id: str | None = None, user_id: str | None = None):
    pm = get_provider_manager()
    _provider_inst, _owner, _key_id = await pm.get_provider(
        provider, model=model_name, team_id=team_id, user_id=user_id,
    )
    # Extract the resolved api_key from provider instance
    api_key = _provider_inst.api_key  # or pass through from get_provider

    if provider == "gemini":
        return GoogleModel(model_name, provider=GoogleProvider(api_key=api_key))
    if provider == "openai":
        return OpenAIModel(model_name, provider=OpenAIProvider(api_key=api_key))
    if provider == "deepseek":
        return OpenAIModel(model_name, provider=OpenAIProvider(api_key=api_key, base_url="https://api.deepseek.com"))
```

### Example 3: Migrating Image Skill (Stack C)

Before:
```python
from app.core.config import settings
api_key = settings.GEMINI_API_KEY
provider = GeminiImageProvider(api_key=api_key, model=model)
result = await provider.generate_image(prompt, aspect_ratio=aspect_ratio)
```

After:
```python
from app.services.ai.provider_manager import get_provider_manager
pm = get_provider_manager()
_provider_inst, _owner, key_id = await pm.get_provider(
    "gemini", model=model, team_id=ctx.team_id, user_id=ctx.user_id,
)
api_key = _provider_inst.api_key  # Extract resolved key
provider = GeminiImageProvider(api_key=api_key, model=model)
try:
    result = await provider.generate_image(prompt, aspect_ratio=aspect_ratio)
    await key_health_manager.report_success(key_id)
except (RateLimitError, TransientError) as e:
    await key_health_manager.report_error(key_id, type(e).__name__, str(e))
    raise
```

### Example 4: Redis Health State Restoration on Startup

```python
# In FastAPI lifespan or startup event
async def restore_health_from_db():
    """D-11: On service restart, restore Redis health state from DB."""
    async with AsyncSessionLocal() as db:
        keys = (await db.execute(
            select(AIProviderKey).where(AIProviderKey.is_active == True)
        )).scalars().all()
        for key in keys:
            await key_health_manager.set_health(key.id, {
                "error_count": key.error_count,
                "last_used_at": key.last_used_at.isoformat() if key.last_used_at else None,
            })
```

### Example 5: Admin Key Health API Endpoint

```python
@router.get("/{provider_id}/keys/{key_id}/health")
async def get_key_health(
    provider_id: str, key_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    config = await _get_config_or_404(provider_id, user, db)
    health = await key_health_manager.get_health(key_id)
    errors = await key_health_manager.get_recent_errors(key_id)
    usage = await key_health_manager.get_usage_trend(key_id, hours=24)
    return {
        "key_id": key_id,
        "error_count": health["error_count"],
        "last_used_at": health.get("last_used_at"),
        "is_healthy": health["is_healthy"],
        "health_badge": _compute_badge(health["error_count"]),  # green/yellow/red
        "recent_errors": errors,
        "usage_trend": usage,
    }

@router.patch("/{provider_id}/keys/{key_id}")
async def update_key(
    provider_id: str, key_id: str,
    data: KeyUpdateRequest,  # is_active, reset_error_count, rate_limit_rpm
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Update DB + invalidate Redis cache + reset Redis health if requested
    ...
```

## Discretion Recommendations

### Migration Strategy (D-12): Incremental by Stack
**Recommendation:** Migrate incrementally in 3 waves, NOT big bang.

| Wave | Scope | Risk | Rollback |
|------|-------|------|----------|
| 1 | Infrastructure (Redis health, credential cache, KeyRotator Redis backing) | Low — no caller changes yet | Delete Redis keys |
| 2 | LLM Skills (10 call sites) + Agent (`create_pydantic_model`) | Medium — all LLM calls affected | Revert `get_provider_sync` calls |
| 3 | Image/Video Skills (2 call sites) + cleanup (`get_provider_sync` removal) | Low — isolated providers | Revert image/video handlers |

**Why not big bang:** 13 call sites across 3 different patterns. Incremental allows testing each stack independently. Feature flags are unnecessary given the small surface area — git revert is sufficient rollback.

### Redis Key Naming Scheme
**Recommendation:**
- Health: `canvex:key_health:{key_id}` (Hash)
- Error history: `canvex:key_errors:{key_id}` (List, capped at 20)
- Usage counter: `canvex:key_usage:{key_id}:{YYYYMMDDHH}` (String/Counter, 7-day TTL)
- Credential cache: `canvex:cred:{provider}:{owner_type}:{owner_id}` (String, 60s TTL)

Prefix with `canvex:` to namespace within shared Redis instance.

### Health Badge Thresholds
**Recommendation:**
| Badge | Color | Condition |
|-------|-------|-----------|
| Healthy | Green | error_count == 0 |
| Degraded | Yellow | 1 <= error_count < 3 |
| Unhealthy | Red | error_count >= 3 (auto-skipped at >= 5, matching existing `MAX_KEY_ERRORS`) |

### Error History Storage Depth
**Recommendation:** Keep last 20 errors per key. Sufficient for admin debugging without excessive Redis memory. Use Redis LPUSH + LTRIM(0, 19).

### Usage Trend Visualization
**Recommendation:** Sparkline-style mini bar chart showing requests per hour for the last 24 hours. Use hourly Redis counters. Simple to implement, low overhead, immediately useful. Chart library: lightweight inline SVG bars (no external chart library needed for a simple 24-bar sparkline).

### DB Sync Interval
**Recommendation:** Every 5 minutes via Celery beat. Balances persistence freshness vs DB load. On graceful shutdown, run one final sync.

### `get_provider_sync()` Deprecation Timeline
**Recommendation:** Remove in Wave 3 of this phase (after all callers migrated). No deprecation period needed since this is a single-phase refactor within the same codebase, not a public API.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| redis-py 4.x separate `aioredis` package | redis-py 5.0+ merged async into `redis.asyncio` | redis-py 5.0 (2023) | Use `import redis.asyncio as aioredis` not `import aioredis` |
| PydanticAI env auto-detection | PydanticAI explicit provider construction | PydanticAI 0.x → 1.x | Use `GoogleProvider(api_key=...)` not rely on env vars |
| SQLite for dev | PostgreSQL enforced (D-16) | This phase | Remove `USE_SQLITE` code paths, simplify database.py |

## Open Questions

1. **GeminiImageProvider/GeminiVideoProvider key exposure**
   - What we know: These providers store `api_key` internally as `self.client = genai.Client(api_key=...)`
   - What's unclear: Whether we can extract the key back from the client, or if `get_provider()` needs to return the raw key alongside the provider instance
   - Recommendation: Have `get_provider()` return `(provider_instance, owner_desc, key_id, api_key)` or store `api_key` as an attribute on provider instances. For image/video, the caller constructs the provider with the resolved key directly (don't go through `_PROVIDER_REGISTRY` for these).

2. **Image/Video provider registration in _PROVIDER_REGISTRY**
   - What we know: `_PROVIDER_REGISTRY` only contains LLM providers (gemini, openai, deepseek). Image/Video providers are constructed directly in skill handlers.
   - What's unclear: Whether to expand `_PROVIDER_REGISTRY` to include image/video provider types or keep them separate.
   - Recommendation: Keep separate. Image/Video providers have different interfaces (`generate_image()` vs `generate()`). `get_provider()` resolves credentials; image/video skills construct their specific provider with the resolved key.

3. **Celery worker `seed_providers_from_env()` timing**
   - What we know: FastAPI runs seed on startup; Celery workers don't.
   - What's unclear: Whether Celery workers need to seed or just rely on FastAPI having already seeded.
   - Recommendation: Celery workers should NOT seed (race condition risk). Only FastAPI seeds. Workers just use `get_provider()` which reads DB. Add a health check: if worker can't resolve any provider, log a clear error message.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.3.5 + pytest-asyncio 0.25.2 |
| Config file | `api/pyproject.toml` [tool.pytest.ini_options] asyncio_mode = "auto" |
| Quick run command | `cd api && uv run pytest tests/test_provider_management.py tests/test_provider_failures.py -x` |
| Full suite command | `cd api && uv run pytest` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONV-01 | LLM skills resolve via unified async path | integration | `uv run pytest tests/test_provider_convergence.py::test_llm_skill_uses_async_provider -x` | ❌ Wave 0 |
| CONV-02 | PydanticAI Agent uses unified provider | integration | `uv run pytest tests/test_provider_convergence.py::test_agent_uses_db_credentials -x` | ❌ Wave 0 |
| CONV-03 | Image skill uses unified provider | integration | `uv run pytest tests/test_provider_convergence.py::test_image_skill_uses_async_provider -x` | ❌ Wave 0 |
| CONV-04 | Video skill uses unified provider | integration | `uv run pytest tests/test_provider_convergence.py::test_video_skill_uses_async_provider -x` | ❌ Wave 0 |
| CONV-05 | get_provider() activated as single entry point | unit | `uv run pytest tests/test_provider_management.py::test_get_provider_async_db_chain -x` | ❌ Wave 0 (file exists but tests are skip-marked) |
| CONV-06 | 14 skills regression-safe | integration | `uv run pytest tests/test_skill_registration.py -x` | ✅ Exists (registration only; needs behavior tests) |
| CONV-07 | KeyRotator round-robin with multiple keys | unit | `uv run pytest tests/test_provider_management.py::test_key_rotation_round_robin -x` | ❌ Wave 0 (skip-marked stub) |
| CONV-08 | Error feedback closes loop | unit | `uv run pytest tests/test_provider_management.py::test_error_feedback_loop -x` | ❌ Wave 0 |
| CONV-09 | Auto-retry with next key on failure | unit | `uv run pytest tests/test_provider_management.py::test_auto_retry_next_key -x` | ❌ Wave 0 |
| CONV-10 | Admin API per-key operations | integration | `uv run pytest tests/test_provider_management.py::test_admin_key_toggle -x` | ❌ Wave 0 |
| CONV-11 | Admin UI per-key health | manual | Visual inspection of provider admin page | N/A |

### Sampling Rate
- **Per task commit:** `cd api && uv run pytest tests/test_provider_management.py tests/test_provider_convergence.py -x`
- **Per wave merge:** `cd api && uv run pytest`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `api/tests/test_provider_convergence.py` — covers CONV-01 through CONV-04, CONV-06 (skill behavior regression)
- [ ] `api/tests/test_provider_management.py` — replace skip-marked stubs with real tests for CONV-05, CONV-07, CONV-08, CONV-09, CONV-10
- [ ] Redis mock fixture in `api/tests/conftest.py` — `fakeredis` or `redis.asyncio` with test Redis

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `provider_manager.py`, `agent_service.py`, all 14 skill files, `ai_provider_config.py`, admin API/UI
- redis-py 6.4.0 (installed): `redis.asyncio` module verified working
- PydanticAI 1.73.0 (installed): `GoogleModel`/`OpenAIModel` with explicit `provider=` parameter verified

### Secondary (MEDIUM confidence)
- redis-py docs (redis.readthedocs.io/en/v6.3.0/examples/asyncio_examples.html) — async patterns
- PydanticAI docs (ai.pydantic.dev/models/google) — GoogleProvider(api_key=...) construction
- Celery+asyncio patterns (stackoverflow, blog posts) — event loop management in workers

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and verified
- Architecture: HIGH — patterns derived from existing codebase + existing dead code
- Pitfalls: HIGH — derived from codebase analysis and established async patterns
- Migration: HIGH — all 13 call sites identified with exact line numbers

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (30 days — stable ecosystem, no fast-moving dependencies)
