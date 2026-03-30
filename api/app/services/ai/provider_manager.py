"""
AI Provider Manager — DB-backed credential chain with round-robin key rotation and failover.

Resolves API keys via credential chain: team → personal → system.
Env vars seed system-level provider configs on first startup.
"""
import base64
import hashlib
import itertools
import logging
from threading import Lock
from typing import Type

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.services.ai.base import AIProviderBase
from app.services.ai.entities import ProviderEntity
from app.core.config import settings

logger = logging.getLogger(__name__)

MAX_KEY_ERRORS = 5

_PROVIDER_REGISTRY: dict[str, tuple[Type[AIProviderBase], str]] = {}

_ENV_KEY_MAP = {
    "gemini": "GEMINI_API_KEY",
    "openai": "OPENAI_API_KEY",
    "deepseek": "DEEPSEEK_API_KEY",
}


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


def _get_env_api_key(provider: str) -> str | None:
    attr = _ENV_KEY_MAP.get(provider)
    if attr:
        val = getattr(settings, attr, None)
        return val if val else None
    return None


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
# KeyRotator — round-robin across active keys with failover
# ---------------------------------------------------------------------------

class KeyRotator:
    """Distributes requests across active keys via round-robin, skipping keys with too many errors."""

    def __init__(self):
        self._pools: dict[str, itertools.cycle] = {}
        self._lock = Lock()

    def next_key(self, provider_name: str, keys: list) -> object:
        with self._lock:
            active = [k for k in keys if k.is_active and k.error_count < MAX_KEY_ERRORS]
            if not active:
                raise ValueError(f"No active API keys for provider '{provider_name}'")
            pool_key = f"{provider_name}:{':'.join(str(k.id) for k in active)}"
            if pool_key not in self._pools:
                self._pools[pool_key] = itertools.cycle(active)
            return next(self._pools[pool_key])

    def report_error(self, key_id: str):
        """Invalidate pool entries containing this key on next rotation."""
        with self._lock:
            self._pools = {k: v for k, v in self._pools.items() if str(key_id) not in k}


# ---------------------------------------------------------------------------
# ProviderManager — DB-backed with credential chain
# ---------------------------------------------------------------------------

class ProviderManager:
    """DB-backed provider manager with credential chain (team → personal → system)
    and round-robin key rotation with failover."""

    def __init__(self):
        self._key_rotator = KeyRotator()

    # ---- Backward-compatible sync API (env-var only) ----

    def get_provider_sync(
        self,
        provider: str,
        model: str | None = None,
        api_key: str | None = None,
    ) -> AIProviderBase:
        """Sync fallback for existing callers — env-var credentials only."""
        _ensure_registry()

        if provider == "auto":
            for candidate in ["gemini", "openai", "deepseek"]:
                candidate_key = api_key or _get_env_api_key(candidate)
                if candidate_key:
                    provider = candidate
                    api_key = candidate_key
                    break
            else:
                raise ValueError(
                    "No AI provider configured. Set GEMINI_API_KEY, OPENAI_API_KEY, or DEEPSEEK_API_KEY."
                )

        key = api_key or _get_env_api_key(provider)
        if not key:
            env_var = _ENV_KEY_MAP.get(provider, f"{provider.upper()}_API_KEY")
            raise ValueError(f"No API key for '{provider}'. Set {env_var} env var.")

        if provider not in _PROVIDER_REGISTRY:
            raise ValueError(f"Unknown provider: {provider}")

        cls, default_model = _PROVIDER_REGISTRY[provider]
        return cls(api_key=key, model=model or default_model)

    # ---- New async DB-backed API ----

    async def get_provider(
        self,
        provider: str,
        model: str | None = None,
        *,
        team_id: str | None = None,
        user_id: str | None = None,
        db: AsyncSession | None = None,
    ) -> tuple[AIProviderBase, str]:
        """Resolve provider with DB credential chain: team → personal → system.

        Returns (provider_instance, key_owner_description).
        Falls back to env-var lookup if no DB keys found.
        """
        _ensure_registry()

        if provider == "auto":
            return await self._auto_select(model=model, team_id=team_id, user_id=user_id, db=db)

        if provider not in _PROVIDER_REGISTRY:
            raise ValueError(f"Unknown provider: {provider}")

        api_key, owner_desc = await self._resolve_key(provider, team_id, user_id, db)

        cls, default_model = _PROVIDER_REGISTRY[provider]
        return cls(api_key=api_key, model=model or default_model), owner_desc

    async def _auto_select(
        self,
        model: str | None = None,
        team_id: str | None = None,
        user_id: str | None = None,
        db: AsyncSession | None = None,
    ) -> tuple[AIProviderBase, str]:
        """Auto-select first available provider by priority."""
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
                active_keys = [k for k in config.keys if k.is_active and k.error_count < MAX_KEY_ERRORS]
                if active_keys and config.provider_name in _PROVIDER_REGISTRY:
                    key_obj = self._key_rotator.next_key(config.provider_name, config.keys)
                    api_key = _decrypt_key(key_obj.api_key_encrypted)
                    cls, default_model = _PROVIDER_REGISTRY[config.provider_name]
                    return cls(api_key=api_key, model=model or default_model), "system"

            for candidate in ["gemini", "openai", "deepseek"]:
                env_key = _get_env_api_key(candidate)
                if env_key and candidate in _PROVIDER_REGISTRY:
                    cls, default_model = _PROVIDER_REGISTRY[candidate]
                    return cls(api_key=env_key, model=model or default_model), "env"

            raise ValueError(
                "No AI provider configured. Set GEMINI_API_KEY, OPENAI_API_KEY, or DEEPSEEK_API_KEY."
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
    ) -> tuple[str, str]:
        """Credential chain: team → personal → system → env fallback.

        Returns (decrypted_api_key, owner_description).
        """
        from app.models.ai_provider_config import AIProviderConfig

        own_session = False
        if db is None:
            from app.core.database import AsyncSessionLocal
            db = AsyncSessionLocal()
            own_session = True

        try:
            chain = []
            if team_id:
                chain.append(("team", team_id))
            if user_id:
                chain.append(("personal", user_id))
            chain.append(("system", None))

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
                        key_obj = self._key_rotator.next_key(provider_name, config.keys)
                        decrypted = _decrypt_key(key_obj.api_key_encrypted)
                        desc = f"{owner_type}:{owner_id}" if owner_id else "system"
                        return decrypted, desc
                    except ValueError:
                        continue

            env_key = _get_env_api_key(provider_name)
            if env_key:
                return env_key, "env"

            raise ValueError(f"No API key configured for provider '{provider_name}'")
        finally:
            if own_session:
                await db.close()

    def get_configured_providers(self) -> list[str]:
        _ensure_registry()
        return [name for name in _PROVIDER_REGISTRY if _get_env_api_key(name)]

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
# Env seeding — create system-level DB rows from env vars on first startup
# ---------------------------------------------------------------------------

async def seed_providers_from_env():
    """Read env vars and create system-level AIProviderConfig + AIProviderKey rows if they don't exist."""
    from app.core.database import AsyncSessionLocal
    from app.models.ai_provider_config import AIProviderConfig, AIProviderKey

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
            config = AIProviderConfig(
                provider_name=provider_name,
                display_name=display_name,
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
