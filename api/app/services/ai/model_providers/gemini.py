"""
Google Gemini Unified Provider — LLM, Image (Imagen), and Video (Veo) via single genai.Client.
"""
import asyncio
import logging
import os
import uuid
from typing import Any, AsyncGenerator, Optional

from google import genai
from google.genai import types

from app.services.ai.llm_provider_base import LLMProviderBase
from app.services.ai.base import Message
from app.services.ai.entities import AIModelEntity, ProviderEntity, ModelType, infer_model_type
from app.services.ai.errors import ContentBlockedError, TransientError

logger = logging.getLogger(__name__)

_SAFETY_OFF = [
    types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="OFF"),
    types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="OFF"),
    types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="OFF"),
    types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="OFF"),
]

PROVIDER_META = {
    "provider_name": "gemini",
    "display_name": "Google Gemini",
    "description": "Google Gemini models — text, image, video, audio multimodal",
    "icon": "gemini",
    "sdk_type": "native",
    "default_base_url": None,
}

_KNOWN_MODELS: dict[str, dict] = {
    "gemini-2.5-flash": {
        "display_name": "Gemini 2.5 Flash",
        "features": ["vision", "tool-call", "stream-tool-call", "agent-thought"],
        "input_types": ["text", "image", "video", "audio", "pdf"],
        "output_types": ["text"],
        "model_properties": {"mode": "chat", "context_size": 1048576},
        "parameter_rules": [
            {"name": "temperature", "use_template": "temperature"},
            {"name": "top_p", "use_template": "top_p"},
            {"name": "max_tokens", "use_template": "max_tokens", "default": 65536, "max": 65536},
        ],
        "deprecated": False,
        "input_token_limit": 1048576,
        "output_token_limit": 65536,
        "default_pricing": {"pricing_model": "per_token", "input_price_per_1k": "0.00015", "output_price_per_1k": "0.0006"},
    },
    "gemini-2.5-pro": {
        "display_name": "Gemini 2.5 Pro",
        "features": ["vision", "tool-call", "stream-tool-call", "agent-thought"],
        "input_types": ["text", "image", "video", "audio", "pdf"],
        "output_types": ["text"],
        "model_properties": {"mode": "chat", "context_size": 1048576},
        "parameter_rules": [
            {"name": "temperature", "use_template": "temperature"},
            {"name": "top_p", "use_template": "top_p"},
            {"name": "max_tokens", "use_template": "max_tokens", "default": 65536, "max": 65536},
        ],
        "deprecated": False,
        "input_token_limit": 1048576,
        "output_token_limit": 65536,
        "default_pricing": {"pricing_model": "per_token", "input_price_per_1k": "0.00125", "output_price_per_1k": "0.005"},
    },
    "gemini-2.5-flash-image": {
        "display_name": "Gemini 2.5 Flash Image",
        "features": ["vision"],
        "input_types": ["text", "image"],
        "output_types": ["text", "image"],
        "model_properties": {
            "mode": "chat",
            "aspect_ratios": ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"],
            "image_sizes": ["1K"],
        },
        "parameter_rules": [],
        "deprecated": False,
        "default_pricing": {"pricing_model": "per_image", "price_per_image": "0.039"},
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

    # ------------------------------------------------------------------
    # Image generation (Imagen)
    # ------------------------------------------------------------------

    async def generate_image(
        self,
        prompt: str,
        aspect_ratio: str = "16:9",
        model: str = "imagen-4.0-generate-001",
        number_of_images: int = 1,
    ) -> dict:
        """Generate image via Gemini Imagen API. Returns {url, filename, size}."""
        try:
            response = await self.client.aio.models.generate_images(
                model=model,
                prompt=prompt,
                config=types.GenerateImagesConfig(
                    number_of_images=number_of_images,
                    aspect_ratio=aspect_ratio,
                ),
            )
        except Exception as e:
            err_msg = str(e).lower()
            if "safety" in err_msg or "blocked" in err_msg or "prohibited" in err_msg:
                raise ContentBlockedError(
                    f"Image generation blocked by safety policy: {str(e)[:200]}"
                )
            if "quota" in err_msg or "rate" in err_msg:
                raise TransientError(
                    f"Image generation rate limited: {str(e)[:200]}"
                )
            raise

        if not response.generated_images:
            raise ContentBlockedError(
                "Imagen returned no images (likely content safety filter)"
            )

        from app.core.config import settings

        img_data = response.generated_images[0].image.image_bytes
        filename = f"gen_{uuid.uuid4().hex[:12]}.png"
        upload_dir = os.path.join(settings.UPLOAD_DIR, "generated")
        os.makedirs(upload_dir, exist_ok=True)
        filepath = os.path.join(upload_dir, filename)

        with open(filepath, "wb") as f:
            f.write(img_data)

        url = f"/api/v1/files/generated/{filename}"
        logger.info("Image saved: %s (%d bytes)", filepath, len(img_data))
        return {"url": url, "filename": filename, "size": len(img_data)}

    # ------------------------------------------------------------------
    # Video generation (Veo)
    # ------------------------------------------------------------------

    async def generate_video(
        self,
        prompt: str,
        image_bytes: bytes | None = None,
        aspect_ratio: str = "16:9",
        duration_seconds: int = 5,
        model: str = "veo-2.0-generate-001",
    ) -> dict:
        """Generate video via Gemini Veo API. Returns {url, filename, size, duration_seconds}."""
        try:
            config = types.GenerateVideosConfig(
                aspect_ratio=aspect_ratio,
                number_of_videos=1,
            )
            kwargs: dict = {"model": model, "prompt": prompt, "config": config}
            if image_bytes:
                kwargs["image"] = types.Image(image_bytes=image_bytes)

            operation = await self.client.aio.models.generate_videos(**kwargs)

            for _ in range(120):
                if operation.done:
                    break
                await asyncio.sleep(5)
                operation = await self.client.aio.operations.get(operation)

            if not operation.done:
                raise TransientError("Video generation timed out after 10 minutes")

            if not operation.response or not operation.response.generated_videos:
                raise ContentBlockedError("No video generated — content may have been blocked")

            generated_video = operation.response.generated_videos[0]

            filename = f"video_{uuid.uuid4().hex[:12]}.mp4"
            from app.core.config import settings

            gen_dir = os.path.join(settings.UPLOAD_DIR, "generated")
            os.makedirs(gen_dir, exist_ok=True)
            filepath = os.path.join(gen_dir, filename)

            await self.client.aio.files.download(file=generated_video.video)
            generated_video.video.save(filepath)

            file_size = os.path.getsize(filepath)
            url = f"/api/v1/files/generated/{filename}"

            logger.info("Video generated: %s (%d bytes)", filename, file_size)
            return {
                "url": url,
                "filename": filename,
                "size": file_size,
                "duration_seconds": duration_seconds,
            }

        except (ContentBlockedError, TransientError):
            raise
        except Exception as e:
            error_msg = str(e)
            if "not found" in error_msg.lower() or "not supported" in error_msg.lower():
                raise TransientError(f"视频生成模型不可用: {model}. 请检查 API 密钥权限。")
            logger.exception("Video generation failed")
            raise TransientError(f"视频生成失败: {error_msg}")

    # ------------------------------------------------------------------
    # Model listing
    # ------------------------------------------------------------------

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
        features = meta.get("features", [])
        output_types = meta.get("output_types", [])
        model_type = infer_model_type(output_types=output_types, features=features, model_name=name)

        api_input_token_limit: int | None = None
        api_output_token_limit: int | None = None
        api_description: str | None = None

        if api_model is not None:
            api_description = getattr(api_model, "description", None)
            api_input_token_limit = getattr(api_model, "input_token_limit", None)
            api_output_token_limit = getattr(api_model, "output_token_limit", None)

        return AIModelEntity(
            name=name,
            display_name=meta.get("display_name", name),
            description=api_description,
            model_type=model_type,
            features=features,
            input_types=meta.get("input_types", []),
            output_types=output_types,
            model_properties=meta.get("model_properties"),
            parameter_rules=meta.get("parameter_rules", []),
            input_token_limit=api_input_token_limit,
            output_token_limit=api_output_token_limit,
            deprecated=meta.get("deprecated", False),
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
