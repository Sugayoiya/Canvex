"""
Gemini Imagen Provider — simplified image generation via google.genai SDK.

Artifact storage contract:
- Images saved to UPLOAD_DIR/generated/{filename}.png
- Accessible via /api/v1/files/generated/{filename}
- Retention: persisted until explicit cleanup (no auto-expiry in Phase 02)
"""
import logging
import os
import uuid

from google import genai
from google.genai import types

from app.services.ai.errors import ContentBlockedError, TransientError

logger = logging.getLogger(__name__)


class GeminiImageProvider:
    """Generate images via Gemini Imagen API."""

    def __init__(self, api_key: str, model: str = "imagen-4.0-generate-001"):
        self.client = genai.Client(api_key=api_key, http_options={"timeout": 120_000})
        self.model = model
        self.provider_name = "gemini"

    async def generate_image(
        self,
        prompt: str,
        aspect_ratio: str = "16:9",
        number_of_images: int = 1,
    ) -> dict:
        """Generate image via Gemini Imagen API. Returns {url, filename, size}."""
        try:
            response = await self.client.aio.models.generate_images(
                model=self.model,
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
