"""AI tools — 2 LangChain @tool wrappers for image/video generation.

Both tools use ProviderManager for credential resolution and KeyHealthManager
for health reporting. 120s timeout via asyncio.wait_for.
"""
from __future__ import annotations

import asyncio
import json
import logging
import time

from langchain_core.tools import tool
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class GenerateImageInput(BaseModel):
    prompt: str = Field(description="Image generation prompt text")
    aspect_ratio: str = Field(default="16:9", description="Aspect ratio (e.g. 16:9, 9:16, 1:1)")
    model: str = Field(default="imagen-4.0-generate-001", description="Imagen model name")


class GenerateVideoInput(BaseModel):
    prompt: str = Field(description="Video generation prompt text")
    aspect_ratio: str = Field(default="16:9", description="Aspect ratio (e.g. 16:9, 9:16)")
    image_url: str | None = Field(default=None, description="Optional first-frame image URL for image-to-video")
    duration_seconds: int = Field(default=5, description="Video duration in seconds (1-30)")
    model: str = Field(default="veo-2.0-generate-001", description="Veo model name")


@tool(args_schema=GenerateImageInput)
async def generate_image(prompt: str, aspect_ratio: str = "16:9", model: str = "imagen-4.0-generate-001") -> str:
    """Generate an image using AI. Returns JSON with url and filename. Timeout: 120s."""
    from app.agent.tool_context import get_tool_context
    from app.services.ai.provider_manager import get_provider_manager
    from app.services.ai.key_health import get_key_health_manager

    ctx = get_tool_context()
    pm = get_provider_manager()

    try:
        provider, _owner, key_id = await pm.get_provider(
            "gemini", team_id=ctx.team_id, user_id=ctx.user_id,
        )
    except ValueError as e:
        return json.dumps({"error": f"Gemini 未配置: {e}"}, ensure_ascii=False)

    start = time.monotonic()
    try:
        result = await asyncio.wait_for(
            provider.generate_image(prompt, aspect_ratio=aspect_ratio, model=model),
            timeout=120,
        )
        await get_key_health_manager().report_success(key_id)
        return json.dumps(result, ensure_ascii=False)
    except asyncio.TimeoutError:
        await get_key_health_manager().report_error(key_id, "TimeoutError", "图片生成超时（120秒）")
        return json.dumps({"error": "图片生成超时（120秒），请稍后重试"}, ensure_ascii=False)
    except Exception as e:
        from app.services.ai.errors import ContentBlockedError
        duration_ms = int((time.monotonic() - start) * 1000)
        await get_key_health_manager().report_error(key_id, type(e).__name__, str(e)[:200])
        if isinstance(e, ContentBlockedError):
            return json.dumps({"error": f"内容安全策略拦截: {str(e)[:200]}"}, ensure_ascii=False)
        logger.warning("generate_image failed after %dms: %s", duration_ms, str(e)[:200])
        return json.dumps({"error": f"图片生成失败: {str(e)[:200]}"}, ensure_ascii=False)


@tool(args_schema=GenerateVideoInput)
async def generate_video(
    prompt: str,
    aspect_ratio: str = "16:9",
    image_url: str | None = None,
    duration_seconds: int = 5,
    model: str = "veo-2.0-generate-001",
) -> str:
    """Generate a video using AI. Returns JSON with url, filename, duration_seconds. Timeout: 120s."""
    from app.agent.tool_context import get_tool_context
    from app.services.ai.provider_manager import get_provider_manager
    from app.services.ai.key_health import get_key_health_manager

    ctx = get_tool_context()
    pm = get_provider_manager()

    try:
        provider, _owner, key_id = await pm.get_provider(
            "gemini", team_id=ctx.team_id, user_id=ctx.user_id,
        )
    except ValueError as e:
        return json.dumps({"error": f"Gemini 未配置: {e}"}, ensure_ascii=False)

    image_bytes = None
    if image_url:
        import httpx
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(image_url)
                resp.raise_for_status()
                image_bytes = resp.content
        except Exception:
            return json.dumps({"error": "无法下载首帧图片"}, ensure_ascii=False)

    start = time.monotonic()
    try:
        result = await asyncio.wait_for(
            provider.generate_video(
                prompt=prompt,
                image_bytes=image_bytes,
                aspect_ratio=aspect_ratio,
                duration_seconds=duration_seconds,
                model=model,
            ),
            timeout=120,
        )
        await get_key_health_manager().report_success(key_id)
        return json.dumps(
            {
                "url": result["url"],
                "filename": result["filename"],
                "duration_seconds": result.get("duration_seconds"),
            },
            ensure_ascii=False,
        )
    except asyncio.TimeoutError:
        await get_key_health_manager().report_error(key_id, "TimeoutError", "视频生成超时（120秒）")
        return json.dumps({"error": "视频生成超时（120秒），请稍后重试"}, ensure_ascii=False)
    except Exception as e:
        duration_ms = int((time.monotonic() - start) * 1000)
        await get_key_health_manager().report_error(key_id, type(e).__name__, str(e)[:200])
        logger.warning("generate_video failed after %dms: %s", duration_ms, str(e)[:200])
        return json.dumps({"error": f"视频生成失败: {str(e)[:200]}"}, ensure_ascii=False)


AI_TOOLS = [generate_image, generate_video]
