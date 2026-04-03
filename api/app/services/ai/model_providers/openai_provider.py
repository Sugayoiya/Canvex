"""
OpenAI LLM Provider — trimmed whitelist for Canvex.
"""
import logging
from typing import AsyncGenerator

from openai import AsyncOpenAI

from app.services.ai.llm_provider_base import LLMProviderBase
from app.services.ai.base import Message
from app.services.ai.entities import AIModelEntity, ProviderEntity, ModelType, infer_model_type

logger = logging.getLogger(__name__)

PROVIDER_META = {
    "provider_name": "openai",
    "display_name": "OpenAI",
    "description": "OpenAI GPT series — text, code, vision",
    "icon": "openai",
    "sdk_type": "openai_compatible",
    "default_base_url": None,
}

_KNOWN_MODELS: dict[str, dict] = {
    "gpt-4o": {
        "display_name": "GPT-4o",
        "capabilities": ["text", "code", "vision"],
        "input_token_limit": 128000,
        "output_token_limit": 16384,
        "default_temperature": 1.0,
        "max_temperature": 2.0,
        "top_p": 1.0,
        "input_types": ["text", "image", "audio"],
        "output_types": ["text"],
        "thinking": False,
        "default_pricing": {"pricing_model": "per_token", "input_price_per_1k": "0.0025", "output_price_per_1k": "0.01"},
    },
    "gpt-4o-mini": {
        "display_name": "GPT-4o Mini",
        "capabilities": ["text", "code", "vision"],
        "input_token_limit": 128000,
        "output_token_limit": 16384,
        "default_temperature": 1.0,
        "max_temperature": 2.0,
        "top_p": 1.0,
        "input_types": ["text", "image"],
        "output_types": ["text"],
        "thinking": False,
        "default_pricing": {"pricing_model": "per_token", "input_price_per_1k": "0.00015", "output_price_per_1k": "0.0006"},
    },
    "gpt-4.1-mini": {
        "display_name": "GPT-4.1 Mini",
        "capabilities": ["text", "code", "vision"],
        "input_token_limit": 1047576,
        "output_token_limit": 32768,
        "default_temperature": 1.0,
        "max_temperature": 2.0,
        "input_types": ["text", "image"],
        "output_types": ["text"],
        "thinking": False,
        "default_pricing": {"pricing_model": "per_token", "input_price_per_1k": "0.0004", "output_price_per_1k": "0.0016"},
    },
}


class OpenAIProvider(LLMProviderBase):
    """OpenAI API provider."""

    def __init__(self, api_key: str, model: str = "gpt-4o", base_url: str | None = None):
        self.client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        self.model = model
        self.provider_name = "openai"
        self.model_display_name = _KNOWN_MODELS.get(model, {}).get("display_name", model)

    async def generate(
        self,
        messages: list[Message],
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> str:
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": m.role, "content": m.content} for m in messages],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content or ""

    async def stream_generate(
        self,
        messages: list[Message],
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> AsyncGenerator[str, None]:
        stream = await self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": m.role, "content": m.content} for m in messages],
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
        )
        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    async def list_models(self) -> list[AIModelEntity]:
        api_model_ids: set[str] = set()
        try:
            response = await self.client.models.list()
            for m in response.data:
                api_model_ids.add(m.id)
        except Exception as e:
            logger.warning("Failed to fetch models from OpenAI API (%s), using predefined list", e)
            return self.get_predefined_models()

        models = [
            self._build_entity(name, meta)
            for name, meta in _KNOWN_MODELS.items()
            if name in api_model_ids
        ]
        return models if models else self.get_predefined_models()

    @classmethod
    def get_predefined_models(cls) -> list[AIModelEntity]:
        return [cls._build_entity(name, meta) for name, meta in _KNOWN_MODELS.items()]

    @classmethod
    def get_provider_entity(cls) -> ProviderEntity:
        return ProviderEntity(
            provider="openai",
            name="OpenAI",
            description="OpenAI GPT series",
            supported_model_types=[ModelType.LLM, ModelType.IMAGE_GENERATION],
        )

    @staticmethod
    def _build_entity(name: str, meta: dict) -> AIModelEntity:
        output_types = meta.get("output_types")
        capabilities = meta.get("capabilities", [])
        model_type = infer_model_type(output_types=output_types, capabilities=capabilities, model_name=name)
        return AIModelEntity(
            name=name,
            display_name=meta.get("display_name", name),
            model_type=model_type,
            capabilities=capabilities,
            input_token_limit=meta.get("input_token_limit"),
            output_token_limit=meta.get("output_token_limit"),
            default_temperature=meta.get("default_temperature"),
            max_temperature=meta.get("max_temperature"),
            top_p=meta.get("top_p"),
            input_types=meta.get("input_types"),
            output_types=output_types,
            thinking=meta.get("thinking"),
            extra_params=meta.get("extra_params"),
        )
