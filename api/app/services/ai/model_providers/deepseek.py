"""
DeepSeek LLM Provider — OpenAI-compatible API.
"""
import logging
from typing import AsyncGenerator

from openai import AsyncOpenAI

from app.services.ai.llm_provider_base import LLMProviderBase
from app.services.ai.base import Message
from app.services.ai.entities import AIModelEntity, ProviderEntity, ModelType, infer_model_type

logger = logging.getLogger(__name__)

PROVIDER_META = {
    "provider_name": "deepseek",
    "display_name": "DeepSeek",
    "description": "DeepSeek Chat / Reasoner with long-context and code",
    "icon": "deepseek",
    "sdk_type": "openai_compatible",
    "default_base_url": "https://api.deepseek.com/v1",
}

_KNOWN_MODELS: dict[str, dict] = {
    "deepseek-chat": {
        "display_name": "DeepSeek Chat (V3)",
        "features": ["vision", "tool-call", "stream-tool-call"],
        "input_types": ["text", "image"],
        "output_types": ["text"],
        "model_properties": {"mode": "chat", "context_size": 128000},
        "parameter_rules": [
            {"name": "temperature", "use_template": "temperature", "default": 1.0, "max": 2.0},
            {"name": "top_p", "use_template": "top_p"},
            {"name": "max_tokens", "use_template": "max_tokens", "default": 8192, "max": 8192},
            {"name": "frequency_penalty", "use_template": "frequency_penalty"},
            {"name": "presence_penalty", "use_template": "presence_penalty"},
        ],
        "deprecated": False,
        "input_token_limit": 128000,
        "output_token_limit": 8192,
        "default_pricing": {"pricing_model": "per_token", "input_price_per_1k": "0.00027", "output_price_per_1k": "0.0011"},
    },
    "deepseek-reasoner": {
        "display_name": "DeepSeek Reasoner (R1)",
        "features": ["agent-thought"],
        "input_types": ["text"],
        "output_types": ["text"],
        "model_properties": {"mode": "chat", "context_size": 128000},
        "parameter_rules": [
            {"name": "temperature", "use_template": "temperature", "default": 0.6, "max": 1.5},
            {"name": "max_tokens", "use_template": "max_tokens", "default": 65536, "max": 65536},
        ],
        "deprecated": False,
        "input_token_limit": 128000,
        "output_token_limit": 65536,
        "default_pricing": {"pricing_model": "per_token", "input_price_per_1k": "0.00055", "output_price_per_1k": "0.0022"},
    },
}


class DeepSeekProvider(LLMProviderBase):
    """DeepSeek API provider (OpenAI-compatible)."""

    def __init__(self, api_key: str, model: str = "deepseek-chat", base_url: str | None = None):
        base_url = base_url or "https://api.deepseek.com"
        self.base_url = base_url
        self.client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        self.model = model
        self.provider_name = "deepseek"
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
        try:
            response = await self.client.models.list()
            api_model_ids = {m.id for m in response.data}
        except Exception as e:
            logger.warning("Failed to fetch models from API at %s (%s), using predefined", self.base_url, e)
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
            provider="deepseek",
            name="DeepSeek",
            description="DeepSeek Chat / Reasoner with long-context and code",
            supported_model_types=[ModelType.LLM],
        )

    @staticmethod
    def _build_entity(name: str, meta: dict) -> AIModelEntity:
        output_types = meta.get("output_types", [])
        features = meta.get("features", [])
        model_type = infer_model_type(output_types=output_types, features=features, model_name=name)
        return AIModelEntity(
            name=name,
            display_name=meta.get("display_name", name),
            model_type=model_type,
            features=features,
            input_types=meta.get("input_types", []),
            output_types=output_types,
            model_properties=meta.get("model_properties"),
            parameter_rules=meta.get("parameter_rules", []),
            input_token_limit=meta.get("input_token_limit"),
            output_token_limit=meta.get("output_token_limit"),
            deprecated=meta.get("deprecated", False),
        )
