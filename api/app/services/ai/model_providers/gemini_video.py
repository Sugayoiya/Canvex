"""
Gemini Veo Video Provider — video generation via google.genai SDK.

Artifact storage: Videos saved to UPLOAD_DIR/generated/{filename}.mp4
Accessible via /api/v1/files/generated/{filename}
"""
import asyncio
import logging
import os
import uuid

from google import genai
from google.genai import types

from app.services.ai.errors import ContentBlockedError, TransientError

logger = logging.getLogger(__name__)


class GeminiVideoProvider:
    """Generate videos via Gemini Veo API."""

    def __init__(self, api_key: str, model: str = "veo-2.0-generate-001"):
        self.client = genai.Client(api_key=api_key, http_options={"timeout": 300_000})
        self.model = model
        self.provider_name = "gemini"

    async def generate_video(
        self,
        prompt: str,
        image_bytes: bytes | None = None,
        aspect_ratio: str = "16:9",
        duration_seconds: int = 5,
    ) -> dict:
        """Generate video. Returns {url, filename, size, duration_seconds}."""
        try:
            config = types.GenerateVideosConfig(
                aspect_ratio=aspect_ratio,
                number_of_videos=1,
            )
            kwargs: dict = {"model": self.model, "prompt": prompt, "config": config}
            if image_bytes:
                kwargs["image"] = types.Image(image_bytes=image_bytes)

            operation = await self.client.aio.models.generate_videos(**kwargs)

            for _ in range(120):  # 10 min max (120 * 5s)
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
                raise TransientError(f"视频生成模型不可用: {self.model}. 请检查 API 密钥权限。")
            logger.exception("Video generation failed")
            raise TransientError(f"视频生成失败: {error_msg}")
