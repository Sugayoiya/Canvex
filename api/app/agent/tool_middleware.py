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


def get_tools_for_context(
    all_tools: list,
    *,
    has_canvas: bool = False,
    has_episode: bool = False,
) -> list:
    """Return at most 14 tools based on session context, using tool metadata.

    Filtering rules (metadata-driven replacement of hardcoded name sets):
    - context_group == "always": always included
    - context_group == "canvas": included when has_canvas
    - context_group == "episode": included when has_episode
    - context_group == "script": included when NOT has_episode
    """
    selected = []
    for tool in all_tools:
        meta = getattr(tool, "metadata", None) or {}
        group = meta.get("context_group", "always")

        if group == "always":
            selected.append(tool)
        elif group == "canvas" and has_canvas:
            selected.append(tool)
        elif group == "episode" and has_episode:
            selected.append(tool)
        elif group == "script" and not has_episode:
            selected.append(tool)

    if len(selected) > 14:
        logger.warning(
            "Tool count %d exceeds target 14; consider refining metadata context_group values",
            len(selected),
        )

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
