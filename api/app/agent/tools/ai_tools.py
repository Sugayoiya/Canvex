"""AI tools — 2 LangChain @tool wrappers for image/video generation.

Both tools offload work to Celery tasks for retry, persistence, and concurrency
control. In-tool polling with exponential backoff (per D-15).
"""
from __future__ import annotations

import asyncio
import json
import logging

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


async def _poll_celery_result(async_result, *, timeout: float, tool_name: str) -> dict:
    """Poll Celery AsyncResult with exponential backoff. Returns parsed result or error dict."""
    delay = 1.0
    elapsed = 0.0
    while elapsed < timeout:
        await asyncio.sleep(delay)
        elapsed += delay
        if async_result.ready():
            break
        delay = min(delay * 2, 8.0)

    if not async_result.ready():
        return {"error": f"{tool_name} 超时（{int(timeout)}秒），请稍后重试"}
    if async_result.failed():
        exc = async_result.result
        return {"error": f"{tool_name} 失败: {str(exc)[:200]}"}
    return async_result.result


@tool(args_schema=GenerateImageInput)
async def generate_image(prompt: str, aspect_ratio: str = "16:9", model: str = "imagen-4.0-generate-001") -> str:
    """Generate an image using AI. Offloads to Celery worker. Returns JSON with url and filename."""
    from app.agent.tool_context import get_tool_context
    from app.tasks.ai_generation_task import generate_image_task

    ctx = get_tool_context()
    task_result = generate_image_task.apply_async(
        kwargs={
            "prompt": prompt,
            "aspect_ratio": aspect_ratio,
            "model": model,
            "team_id": ctx.team_id,
            "user_id": ctx.user_id,
            "project_id": ctx.project_id,
        },
        queue="ai_generation",
    )
    result = await _poll_celery_result(task_result, timeout=120, tool_name="图片生成")
    return json.dumps(result, ensure_ascii=False)


@tool(args_schema=GenerateVideoInput)
async def generate_video(
    prompt: str,
    aspect_ratio: str = "16:9",
    image_url: str | None = None,
    duration_seconds: int = 5,
    model: str = "veo-2.0-generate-001",
) -> str:
    """Generate a video using AI. Offloads to Celery worker. Returns JSON with url, filename, duration."""
    from app.agent.tool_context import get_tool_context
    from app.tasks.ai_generation_task import generate_video_task

    ctx = get_tool_context()
    task_result = generate_video_task.apply_async(
        kwargs={
            "prompt": prompt,
            "aspect_ratio": aspect_ratio,
            "model": model,
            "team_id": ctx.team_id,
            "user_id": ctx.user_id,
            "image_url": image_url,
            "duration_seconds": duration_seconds,
            "project_id": ctx.project_id,
        },
        queue="media_processing",
    )
    result = await _poll_celery_result(task_result, timeout=300, tool_name="视频生成")
    return json.dumps(result, ensure_ascii=False)


AI_TOOLS = [generate_image, generate_video]
