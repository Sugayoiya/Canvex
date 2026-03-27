"""
Google Gemini LLM Provider — trimmed whitelist for Canvex.
"""
import logging
from typing import Any, AsyncGenerator, Optional

from google import genai
from google.genai import types

from app.services.ai.llm_provider_base import LLMProviderBase
from app.services.ai.base import Message
from app.services.ai.entities import AIModelEntity, ProviderEntity, ModelType, infer_model_type

logger = logging.getLogger(__name__)

_SAFETY_OFF = [
    types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="OFF"),
    types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="OFF"),
    types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="OFF"),
    types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="OFF"),
]

_KNOWN_MODELS: dict[str, dict] = {
    "gemini-2.5-flash": {
        "display_name": "Gemini 2.5 Flash",
        "capabilities": ["text", "code", "vision", "audio", "video"],
        "input_types": ["text", "image", "video", "audio", "pdf"],
        "output_types": ["text"],
        "thinking": True,
    },
    "gemini-2.5-pro": {
        "display_name": "Gemini 2.5 Pro",
        "capabilities": ["text", "code", "vision", "audio", "video"],
        "input_types": ["text", "image", "video", "audio", "pdf"],
        "output_types": ["text"],
        "thinking": True,
    },
    "gemini-2.5-flash-image": {
        "display_name": "Gemini 2.5 Flash Image",
        "capabilities": ["text", "code", "vision", "image"],
        "input_types": ["text", "image"],
        "output_types": ["text", "image"],
        "thinking": False,
        "extra_params": {
            "aspect_ratios": ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"],
            "image_sizes": ["1K"],
        },
    },
}


class GeminiProvider(LLMProviderBase):
    """Google Gemini API provider using google-genai SDK."""

    def __init__(self, api_key: str, model: str = "gemini-2.5-flash"):
        self.client = genai.Client(
            api_key=api_key,
            http_options={"timeout": 300_000},
        )
        self.model = model
        self.provider_name = "gemini"
        self.model_display_name = _KNOWN_MODELS.get(model, {}).get("display_name", model)

    async def generate(
        self,
        messages: list[Message],
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> str:
        contents, system_instruction = self._convert_messages(messages)

        config = types.GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
            system_instruction=system_instruction,
            safety_settings=_SAFETY_OFF,
        )

        response = await self.client.aio.models.generate_content(
            model=self.model,
            contents=contents,
            config=config,
        )

        if hasattr(response, "text") and response.text is not None:
            return response.text

        candidates = getattr(response, "candidates", None)
        if candidates:
            candidate = candidates[0]
            if hasattr(candidate, "content") and candidate.content and candidate.content.parts:
                parts_text = "".join(
                    p.text for p in candidate.content.parts if hasattr(p, "text") and p.text
                )
                if parts_text:
                    return parts_text

        prompt_feedback = getattr(response, "prompt_feedback", None)
        if prompt_feedback and hasattr(prompt_feedback, "block_reason"):
            reason = str(
                prompt_feedback.block_reason.name
                if hasattr(prompt_feedback.block_reason, "name")
                else prompt_feedback.block_reason
            )
            raise ValueError(f"Content blocked by Gemini safety policy ({reason})")

        raise ValueError("Gemini returned empty result")

    async def stream_generate(
        self,
        messages: list[Message],
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> AsyncGenerator[str, None]:
        contents, system_instruction = self._convert_messages(messages)

        config = types.GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
            system_instruction=system_instruction,
            safety_settings=_SAFETY_OFF,
        )

        async for chunk in await self.client.aio.models.generate_content_stream(
            model=self.model,
            contents=contents,
            config=config,
        ):
            if chunk.text:
                yield chunk.text

    def _convert_messages(self, messages: list[Message]) -> tuple[list[types.Content], Optional[str]]:
        import base64
        contents = []
        system_parts = []

        for msg in messages:
            if msg.role == "system":
                system_parts.append(msg.content)
            elif msg.role == "user":
                parts = []
                if msg.image_b64 and msg.image_mime_type:
                    image_bytes = base64.b64decode(msg.image_b64)
                    parts.append(types.Part.from_bytes(data=image_bytes, mime_type=msg.image_mime_type))
                parts.append(types.Part.from_text(text=msg.content or ""))
                contents.append(types.Content(role="user", parts=parts))
            elif msg.role == "assistant":
                contents.append(types.Content(
                    role="model",
                    parts=[types.Part.from_text(text=msg.content)],
                ))

        system_instruction = "\n".join(system_parts) if system_parts else None
        return contents, system_instruction

    async def list_models(self) -> list[AIModelEntity]:
        api_models_map: dict[str, Any] = {}
        try:
            async for model in await self.client.aio.models.list():
                model_name = getattr(model, "name", str(model))
                if model_name.startswith("models/"):
                    model_name = model_name[7:]
                api_models_map[model_name] = model
        except Exception as e:
            logger.warning("Failed to fetch models from Gemini API (%s), using predefined list", e)
            return self.get_predefined_models()

        return [self._build_entity(name, meta, api_models_map.get(name)) for name, meta in _KNOWN_MODELS.items()]

    @classmethod
    def _build_entity(cls, name: str, meta: dict, api_model: Any = None) -> AIModelEntity:
        capabilities = meta.get("capabilities", [])
        output_types = meta.get("output_types")
        model_type = infer_model_type(output_types=output_types, capabilities=capabilities, model_name=name)

        api_input_token_limit: int | None = None
        api_output_token_limit: int | None = None
        api_description: str | None = None
        thinking = meta.get("thinking")

        if api_model is not None:
            api_description = getattr(api_model, "description", None)
            api_input_token_limit = getattr(api_model, "input_token_limit", None)
            api_output_token_limit = getattr(api_model, "output_token_limit", None)

        return AIModelEntity(
            name=name,
            display_name=meta.get("display_name", name),
            description=api_description,
            model_type=model_type,
            capabilities=capabilities,
            input_token_limit=api_input_token_limit,
            output_token_limit=api_output_token_limit,
            input_types=meta.get("input_types"),
            output_types=output_types,
            thinking=thinking,
            extra_params=meta.get("extra_params"),
        )

    @classmethod
    def get_predefined_models(cls) -> list[AIModelEntity]:
        return [cls._build_entity(name, meta) for name, meta in _KNOWN_MODELS.items()]

    @classmethod
    def get_provider_entity(cls) -> ProviderEntity:
        return ProviderEntity(
            provider="gemini",
            name="Google Gemini",
            description="Google Gemini models — text, image, video, audio multimodal",
            supported_model_types=[ModelType.LLM, ModelType.IMAGE_GENERATION],
        )
