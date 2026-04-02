"""Tool gating middleware: context-aware tool subset + standard timeout wrapper.

Addresses review concern: 17 tools near LLM reliability cliff.
Solution: expose ≤14 tools per agent invocation based on session context.
"""
from __future__ import annotations

import asyncio
import functools
import json
import logging
from typing import Callable

logger = logging.getLogger(__name__)

TOOL_TIMEOUT_DEFAULT = 60
TOOL_TIMEOUT_AI = 120

_AI_TOOL_NAMES = {"generate_image", "generate_video"}

_ALWAYS_TOOLS = {
    "get_project_info", "get_episodes", "get_script",
    "get_characters", "get_scenes",
    "read_skill", "read_resource",
}

_CANVAS_TOOLS = {"get_canvas_state"}

_STORYBOARD_TOOLS = {
    "save_shot_plan", "save_shot_details", "update_shot",
    "generate_image", "generate_video",
    "get_style_templates",
}

_SCRIPT_TOOLS = {
    "save_characters", "save_scenes", "save_screenplay",
}


def get_tools_for_context(
    all_tools: list,
    *,
    has_canvas: bool = False,
    has_episode: bool = False,
) -> list:
    """Return ≤14 tools based on session context.

    Default set: 7 core + 3 script tools (10).
    With canvas: +1 (11).
    With episode/storyboard: +6 (up to 14 max with overlap).
    """
    allowed_names = set(_ALWAYS_TOOLS) | set(_SCRIPT_TOOLS)

    if has_canvas:
        allowed_names |= _CANVAS_TOOLS
    if has_episode:
        allowed_names |= _STORYBOARD_TOOLS

    selected = [t for t in all_tools if t.name in allowed_names]

    if len(selected) > 14:
        logger.warning("Tool count %d exceeds target 14; consider refining gating rules", len(selected))

    return selected


def tool_timeout(timeout_seconds: int | None = None):
    """Decorator: wrap an async tool function with asyncio.wait_for timeout.

    If timeout_seconds is None, auto-selects based on tool name:
    120s for AI tools (generate_image/generate_video), 60s otherwise.
    """
    def decorator(fn: Callable):
        @functools.wraps(fn)
        async def wrapper(*args, **kwargs):
            t = timeout_seconds
            if t is None:
                t = TOOL_TIMEOUT_AI if fn.__name__ in _AI_TOOL_NAMES else TOOL_TIMEOUT_DEFAULT
            try:
                return await asyncio.wait_for(fn(*args, **kwargs), timeout=t)
            except asyncio.TimeoutError:
                return json.dumps(
                    {"error": f"Tool '{fn.__name__}' timed out after {t}s"},
                    ensure_ascii=False,
                )
        return wrapper
    return decorator
