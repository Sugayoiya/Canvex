"""
AI Provider Manager — env-only credential lookup for Phase 02.

No DB credential lookup, no ThrottledLLMProvider proxy.
"""
import logging
from typing import Type

from app.services.ai.base import AIProviderBase
from app.services.ai.entities import ProviderEntity
from app.core.config import settings

logger = logging.getLogger(__name__)

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


class ProviderManager:
    """Simplified provider manager — env-var credentials only."""

    def get_provider(
        self,
        provider: str,
        model: str | None = None,
        api_key: str | None = None,
    ) -> AIProviderBase:
        _ensure_registry()

        key = api_key or _get_env_api_key(provider)
        if not key:
            env_var = _ENV_KEY_MAP.get(provider, f"{provider.upper()}_API_KEY")
            raise ValueError(f"No API key for '{provider}'. Set {env_var} env var.")

        if provider not in _PROVIDER_REGISTRY:
            raise ValueError(f"Unknown provider: {provider}")

        cls, default_model = _PROVIDER_REGISTRY[provider]
        return cls(api_key=key, model=model or default_model)

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
