"""
AI Provider Manager — DB-backed credential chain with Redis-backed health and caching.

Resolves API keys via async credential chain: team → personal → system.
No env-var fallback at runtime — env vars seed system-level configs on startup.

Consistency model:
- Redis is authoritative for LIVE health reads (error_count, last_used_at from AI calls)
- DB is authoritative for PERSISTENCE and RECOVERY (survives Redis restart)
- Admin mutations (key toggle, error reset) write-through to BOTH Redis + DB simultaneously
- Background sync (5-min Celery beat) writes Redis→DB for health counters updated by AI calls
- On startup: DB→Redis restore. On shutdown: Redis→DB final sync.
"""
from __future__ import annotations

import base64
import contextvars
import hashlib
import itertools
import logging
from typing import Type

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.services.ai.base import AIProviderBase
from app.services.ai.entities import ProviderEntity
from app.services.ai.key_health import get_key_health_manager
from app.services.ai.credential_cache import get_credential_cache
from app.core.config import settings

logger = logging.getLogger(__name__)

MAX_KEY_ERRORS = 5

_current_key_id_var: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "_current_key_id_var", default=None
)

_PROVIDER_REGISTRY: dict[str, tuple[Type[AIProviderBase], str]] = {}

def _ensure_registry():
    if _PROVIDER_REGISTRY:
        return

    from app.services.ai.model_providers.gemini import GeminiProvider
    from app.services.ai.model_providers.openai_provider import OpenAIProvider
    from app.services.ai.model_providers.deepseek import DeepSeekProvider

    _PROVIDER_REGISTRY.update({
        "gemini": (GeminiProvider, "gemini-2.5-flash"),
        "openai": (OpenAIProvider, "gpt-4o"),
        "deepseek": (DeepSeekProvider, "deepseek-chat"),
    })


# ---------------------------------------------------------------------------
# Encryption helpers (Fernet derived from SECRET_KEY)
# ---------------------------------------------------------------------------

def _get_fernet():
    from cryptography.fernet import Fernet
    key_bytes = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key_bytes))


def encrypt_api_key(plain: str) -> str:
    return _get_fernet().encrypt(plain.encode()).decode()


def _decrypt_key(encrypted: str) -> str:
    return _get_fernet().decrypt(encrypted.encode()).decode()


# ---------------------------------------------------------------------------
# KeyRotator — async round-robin using Redis health state
# ---------------------------------------------------------------------------

class KeyRotator:
    """Distributes requests across active keys via round-robin, using Redis health for filtering."""

    def __init__(self):
        self._pools: dict[str, itertools.cycle] = {}

    async def next_key(self, provider_name: str, keys: list) -> object:
        """Select next healthy key via round-robin. Uses KeyHealthManager for health checks."""
        khm = get_key_health_manager()
        active = []
        for k in keys:
            if not k.is_active:
                continue
            health = await khm.get_health(k.id)
            if health["is_healthy"]:
                active.append(k)
            else:
                logger.info("key_skip_unhealthy key_id=%s error_count=%s", k.id, health["error_count"])

        if not active:
            raise ValueError(f"No active API keys for provider '{provider_name}'")

        pool_key = f"{provider_name}:{':'.join(str(k.id) for k in active)}"
        if pool_key not in self._pools:
            self._pools[pool_key] = itertools.cycle(active)
        return next(self._pools[pool_key])

    def invalidate_pool(self, key_id: str):
        """Remove pool entries containing this key so next rotation rebuilds."""
        self._pools = {k: v for k, v in self._pools.items() if str(key_id) not in k}


# ---------------------------------------------------------------------------
# ProviderManager — DB-backed with Redis credential cache and health
# ---------------------------------------------------------------------------

class ProviderManager:
    """DB-backed provider manager with Redis credential cache and health-aware key rotation.

    Credential chain: team → personal → system (no env-var fallback at runtime).
    """

    def __init__(self):
        self._key_rotator = KeyRotator()

    async def get_provider(
        self,
        provider: str,
        model: str | None = None,
        *,
        team_id: str | None = None,
        user_id: str | None = None,
        db: AsyncSession | None = None,
    ) -> tuple[AIProviderBase, str, str]:
        """Resolve provider with DB credential chain: team → personal → system.

        Returns (provider_instance, key_owner_description, key_id).
        Uses Redis CredentialCache for fast resolution and KeyHealthManager for rotation.
        """
        _ensure_registry()

        if provider == "auto":
            return await self._auto_select(model=model, team_id=team_id, user_id=user_id, db=db)

        if provider not in _PROVIDER_REGISTRY:
            raise ValueError(f"Unknown provider: {provider}")

        api_key, owner_desc, key_id = await self._resolve_key(provider, team_id, user_id, db)
        _current_key_id_var.set(key_id)

        cls, default_model = _PROVIDER_REGISTRY[provider]
        return cls(api_key=api_key, model=model or default_model), owner_desc, key_id

    async def get_provider_with_retry(
        self,
        provider: str,
        model: str | None = None,
        *,
        team_id: str | None = None,
        user_id: str | None = None,
        db: AsyncSession | None = None,
        max_retries: int = 2,
    ) -> tuple[AIProviderBase, str, str]:
        """Call get_provider() with automatic key rotation on failure.

        max_retries=2 for LLM (idempotent), =1 for image/video (cost-sensitive).
        On retryable errors, reports error to KeyHealthManager and rotates to next key.
        """
        last_error: Exception | None = None
        for attempt in range(max_retries + 1):
            try:
                return await self.get_provider(
                    provider, model, team_id=team_id, user_id=user_id, db=db,
                )
            except ValueError:
                raise
            except Exception as e:
                last_error = e
                key_id = _current_key_id_var.get(None)
                if key_id:
                    await get_key_health_manager().report_error(
                        key_id, type(e).__name__, str(e)
                    )
                    self._key_rotator.invalidate_pool(key_id)
                logger.warning(
                    "provider_retry attempt=%d max_retries=%d provider=%s error=%s",
                    attempt + 1, max_retries, provider, str(e),
                )
                if attempt == max_retries:
                    raise
        raise last_error  # type: ignore[misc]

    async def _auto_select(
        self,
        model: str | None = None,
        team_id: str | None = None,
        user_id: str | None = None,
        db: AsyncSession | None = None,
    ) -> tuple[AIProviderBase, str, str]:
        """Auto-select first available provider by priority (DB-only, no env fallback)."""
        from app.models.ai_provider_config import AIProviderConfig

        own_session = False
        if db is None:
            from app.core.database import AsyncSessionLocal
            db = AsyncSessionLocal()
            own_session = True

        try:
            result = await db.execute(
                select(AIProviderConfig)
                .where(AIProviderConfig.owner_type == "system", AIProviderConfig.is_enabled == True)
                .options(selectinload(AIProviderConfig.keys))
                .order_by(AIProviderConfig.priority.asc())
            )
            configs = result.scalars().all()

            for config in configs:
                if config.provider_name not in _PROVIDER_REGISTRY:
                    continue
                try:
                    key_obj = await self._key_rotator.next_key(config.provider_name, config.keys)
                    api_key = _decrypt_key(key_obj.api_key_encrypted)
                    key_id = key_obj.id
                    _current_key_id_var.set(key_id)
                    cls, default_model = _PROVIDER_REGISTRY[config.provider_name]
                    return cls(api_key=api_key, model=model or default_model), "system", key_id
                except ValueError:
                    continue

            raise ValueError(
                "No AI provider configured. Ensure seed_providers_from_env() has run "
                "or configure keys via Admin."
            )
        finally:
            if own_session:
                await db.close()

    async def _resolve_key(
        self,
        provider_name: str,
        team_id: str | None,
        user_id: str | None,
        db: AsyncSession | None,
    ) -> tuple[str, str, str]:
        """Credential chain: team → personal → system with Redis cache.

        Returns (decrypted_api_key, owner_description, key_id).
        """
        from app.models.ai_provider_config import AIProviderConfig, AIProviderKey

        own_session = False
        if db is None:
            from app.core.database import AsyncSessionLocal
            db = AsyncSessionLocal()
            own_session = True

        try:
            chain: list[tuple[str, str | None]] = []
            if team_id:
                chain.append(("team", team_id))
            if user_id:
                chain.append(("personal", user_id))
            chain.append(("system", None))

            cache = get_credential_cache()

            # Check Redis credential cache first
            cached = await cache.get_cached(provider_name, chain)
            if cached:
                key_row = (await db.execute(
                    select(AIProviderKey).where(
                        AIProviderKey.id == cached["key_id"],
                        AIProviderKey.is_active == True,
                    )
                )).scalar_one_or_none()
                if key_row:
                    decrypted = _decrypt_key(key_row.api_key_encrypted)
                    return decrypted, cached.get("owner_desc", cached.get("owner_type", "cached")), cached["key_id"]
                # Key was deleted/disabled since caching — fall through to DB chain walk

            # Walk the DB credential chain
            for owner_type, owner_id in chain:
                stmt = (
                    select(AIProviderConfig)
                    .where(
                        AIProviderConfig.provider_name == provider_name,
                        AIProviderConfig.owner_type == owner_type,
                        AIProviderConfig.is_enabled == True,
                    )
                    .options(selectinload(AIProviderConfig.keys))
                )
                if owner_id is not None:
                    stmt = stmt.where(AIProviderConfig.owner_id == owner_id)
                else:
                    stmt = stmt.where(AIProviderConfig.owner_id.is_(None))

                result = await db.execute(stmt)
                config = result.scalar_one_or_none()

                if config and config.keys:
                    try:
                        key_obj = await self._key_rotator.next_key(provider_name, config.keys)
                        decrypted = _decrypt_key(key_obj.api_key_encrypted)
                        desc = f"{owner_type}:{owner_id}" if owner_id else "system"

                        # Populate cache with metadata only (never the decrypted key)
                        await cache.set_cached(provider_name, owner_type, owner_id, {
                            "key_id": key_obj.id,
                            "config_id": config.id,
                            "provider_name": provider_name,
                            "owner_type": owner_type,
                            "owner_desc": desc,
                        })

                        return decrypted, desc, key_obj.id
                    except ValueError:
                        continue

            raise ValueError(
                f"No API key configured for provider '{provider_name}'. "
                "Ensure seed_providers_from_env() has run or configure keys via Admin."
            )
        finally:
            if own_session:
                await db.close()

    async def resolve_api_key(
        self,
        provider: str,
        *,
        team_id: str | None = None,
        user_id: str | None = None,
        db: AsyncSession | None = None,
    ) -> tuple[str, str, str]:
        """Resolve decrypted API key without constructing a provider instance.

        Returns (api_key, owner_description, key_id).
        Only used by agent_service (PydanticAI needs raw key for its own SDK).
        All skills should use get_provider() instead.
        """
        _ensure_registry()
        if provider not in _PROVIDER_REGISTRY:
            raise ValueError(f"Unknown provider: {provider}")
        api_key, owner_desc, key_id = await self._resolve_key(provider, team_id, user_id, db)
        _current_key_id_var.set(key_id)
        return api_key, owner_desc, key_id

    async def resolve_langchain_llm(
        self,
        provider_name: str,
        model_name: str,
        *,
        team_id: str | None = None,
        user_id: str | None = None,
        db: AsyncSession | None = None,
        **kwargs,
    ) -> "BaseChatModel":
        """Resolve a LangChain BaseChatModel via DB-backed credential chain.

        Uses sdk_type from AIProviderConfig to determine LangChain class:
        - "native" (Gemini) → ChatGoogleGenerativeAI
        - "openai_compatible" (OpenAI, DeepSeek, etc.) → ChatOpenAI with base_url
        Always sets streaming=True for SSE support.
        """
        _ensure_registry()
        if provider_name not in _PROVIDER_REGISTRY:
            raise ValueError(f"Unknown provider: {provider_name}")

        api_key, _owner, key_id = await self._resolve_key(
            provider_name, team_id, user_id, db,
        )
        _current_key_id_var.set(key_id)

        config = await self._get_provider_config(provider_name, db)
        effective_base_url = (config.base_url or config.default_base_url) if config else None
        sdk_type = config.sdk_type if config else "native"

        if sdk_type == "native":
            from langchain_google_genai import ChatGoogleGenerativeAI
            return ChatGoogleGenerativeAI(
                model=model_name, api_key=api_key, streaming=True, **kwargs,
            )
        else:
            from langchain_openai import ChatOpenAI
            extra: dict = {}
            if effective_base_url:
                extra["base_url"] = effective_base_url
            return ChatOpenAI(
                model=model_name, api_key=api_key, streaming=True, **extra, **kwargs,
            )

    async def _get_provider_config(
        self,
        provider_name: str,
        db: AsyncSession | None = None,
    ) -> "AIProviderConfig | None":
        """Fetch the system-level AIProviderConfig for a provider_name."""
        from app.models.ai_provider_config import AIProviderConfig

        own_session = False
        if db is None:
            from app.core.database import AsyncSessionLocal
            db = AsyncSessionLocal()
            own_session = True

        try:
            result = await db.execute(
                select(AIProviderConfig).where(
                    AIProviderConfig.provider_name == provider_name,
                    AIProviderConfig.owner_type == "system",
                )
            )
            return result.scalar_one_or_none()
        finally:
            if own_session:
                await db.close()

    def get_configured_providers(self) -> list[str]:
        _ensure_registry()
        return list(_PROVIDER_REGISTRY.keys())

    def get_all_provider_entities(self) -> list[ProviderEntity]:
        _ensure_registry()
        entities = []
        seen: set[type] = set()
        for _name, (cls, _default) in _PROVIDER_REGISTRY.items():
            if cls not in seen:
                seen.add(cls)
                try:
                    entities.append(cls.get_provider_entity())
                except Exception:
                    pass
        return entities


_manager: ProviderManager | None = None


def get_provider_manager() -> ProviderManager:
    global _manager
    if _manager is None:
        _manager = ProviderManager()
    return _manager


# ---------------------------------------------------------------------------
# Model resolution helpers
# ---------------------------------------------------------------------------

async def resolve_provider_for_model(
    model_name: str,
    *,
    db: AsyncSession | None = None,
) -> tuple[str, str | None]:
    """Return (provider_name, effective_base_url) for a model_name via ModelPricing JOIN.

    Raises ValueError if no active pricing association found.
    """
    from app.models.ai_provider_config import AIProviderConfig, AIModelConfig
    from app.models.model_pricing import ModelPricing

    own_session = False
    if db is None:
        from app.core.database import AsyncSessionLocal
        db = AsyncSessionLocal()
        own_session = True
    try:
        stmt = (
            select(
                AIProviderConfig.provider_name,
                AIProviderConfig.base_url,
                AIProviderConfig.default_base_url,
            )
            .join(ModelPricing, ModelPricing.provider_config_id == AIProviderConfig.id)
            .join(AIModelConfig, ModelPricing.model_config_id == AIModelConfig.id)
            .where(
                AIModelConfig.model_name == model_name,
                ModelPricing.is_active == True,  # noqa: E712
                AIProviderConfig.is_enabled == True,  # noqa: E712
            )
            .limit(1)
        )
        row = (await db.execute(stmt)).first()
        if not row:
            raise ValueError(f"No active provider found for model '{model_name}'")
        return row[0], row[1] or row[2]
    finally:
        if own_session:
            await db.close()


async def resolve_model_for_task(
    model_name: str | None,
    model_type: str = "llm",
    *,
    project_id: str | None = None,
    user_id: str | None = None,
    team_id: str | None = None,
    db: AsyncSession,
) -> str:
    """4-layer fallback: manual selection > project default > personal/team default > system default.

    Returns the resolved model_name. Raises ValueError if no model found.
    """
    # Layer 1: explicit selection
    if model_name:
        return model_name

    settings_key = f"default_{model_type}_model"

    # Layer 2: project default
    if project_id:
        from app.models.project import Project
        project = await db.get(Project, project_id)
        if project and project.settings and project.settings.get(settings_key):
            return project.settings[settings_key]

        # Layer 3: personal or team default (based on project owner_type)
        if project and project.owner_type == "team":
            if project.owner_id:
                from app.models.team import Team
                team = await db.get(Team, project.owner_id)
                if team and team.settings and team.settings.get(settings_key):
                    return team.settings[settings_key]
        else:
            if user_id:
                from app.models.user import User
                user = await db.get(User, user_id)
                if user and user.settings and user.settings.get(settings_key):
                    return user.settings[settings_key]
    else:
        # No project context — try user/team defaults directly
        if user_id:
            from app.models.user import User
            user = await db.get(User, user_id)
            if user and user.settings and user.settings.get(settings_key):
                return user.settings[settings_key]
        if team_id:
            from app.models.team import Team
            team = await db.get(Team, team_id)
            if team and team.settings and team.settings.get(settings_key):
                return team.settings[settings_key]

    # Layer 4: system default
    from app.models.system_setting import SystemSetting
    setting = await db.get(SystemSetting, settings_key)
    if setting and setting.value:
        return setting.value

    raise ValueError(f"No default {model_type} model configured. Contact admin to set up API keys.")


# ---------------------------------------------------------------------------
# Lifecycle — startup/shutdown hooks
# ---------------------------------------------------------------------------

async def restore_health_from_db():
    """D-11: On service restart, restore Redis health state from DB."""
    from app.core.database import AsyncSessionLocal
    from app.models.ai_provider_config import AIProviderKey

    khm = get_key_health_manager()
    try:
        async with AsyncSessionLocal() as db:
            keys = (await db.execute(select(AIProviderKey))).scalars().all()
            for key in keys:
                await khm.set_health(key.id, {
                    "error_count": str(key.error_count),
                    "last_used_at": key.last_used_at.isoformat() if key.last_used_at else "",
                })
        logger.info("health_restored_from_db key_count=%d", len(keys))
    except Exception as e:
        logger.error("health_restore_failed error=%s", str(e))


async def sync_health_to_db():
    """D-10: Sync Redis health state to PostgreSQL for persistence."""
    from app.core.database import AsyncSessionLocal
    from app.models.ai_provider_config import AIProviderKey
    from datetime import datetime

    khm = get_key_health_manager()
    try:
        async with AsyncSessionLocal() as db:
            keys = (await db.execute(select(AIProviderKey))).scalars().all()
            for key in keys:
                health = await khm.get_health(key.id)
                key.error_count = health["error_count"]
                if health.get("last_used_at"):
                    try:
                        key.last_used_at = datetime.fromisoformat(health["last_used_at"])
                    except (ValueError, TypeError):
                        pass
            await db.commit()
        logger.info("health_synced_to_db key_count=%d", len(keys))
    except Exception as e:
        logger.error("health_sync_failed error=%s", str(e))


# ---------------------------------------------------------------------------
# Env seeding — create system-level DB rows from env vars on first startup
# ---------------------------------------------------------------------------

async def seed_providers_from_env():
    """Read env vars and create system-level AIProviderConfig + AIProviderKey rows if they don't exist."""
    from app.core.database import AsyncSessionLocal
    from app.models.ai_provider_config import AIProviderConfig, AIProviderKey
    from app.services.ai.preset_seed import get_all_provider_metadata

    meta_lookup: dict[str, dict] = {}
    for m in get_all_provider_metadata():
        meta_lookup[m["provider_name"]] = m

    env_map = {
        "gemini": ("Gemini", settings.GEMINI_API_KEY),
        "openai": ("OpenAI", settings.OPENAI_API_KEY),
        "deepseek": ("DeepSeek", settings.DEEPSEEK_API_KEY),
    }
    async with AsyncSessionLocal() as session:
        for idx, (provider_name, (display_name, api_key)) in enumerate(env_map.items()):
            if not api_key:
                continue
            existing = (await session.execute(
                select(AIProviderConfig).where(
                    AIProviderConfig.provider_name == provider_name,
                    AIProviderConfig.owner_type == "system",
                )
            )).scalar_one_or_none()
            if existing:
                continue

            pm = meta_lookup.get(provider_name, {})
            config = AIProviderConfig(
                provider_name=provider_name,
                display_name=pm.get("display_name", display_name),
                description=pm.get("description"),
                icon=pm.get("icon"),
                sdk_type=pm.get("sdk_type", "native"),
                default_base_url=pm.get("default_base_url"),
                is_preset=True,
                owner_type="system",
                priority=idx,
            )
            session.add(config)
            await session.flush()
            session.add(AIProviderKey(
                provider_config_id=config.id,
                api_key_encrypted=encrypt_api_key(api_key),
                label=f"{display_name} (env seed)",
            ))
            logger.info("Seeded system provider: %s", provider_name)
        await session.commit()
