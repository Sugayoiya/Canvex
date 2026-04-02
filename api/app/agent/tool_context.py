"""Session context propagation via contextvars with copy_context() safety.

Each agent invocation sets project/user/team identity before tool execution.
Tools read this context to enforce project-boundary security and resolve credentials.
"""
from __future__ import annotations

import contextvars
from dataclasses import dataclass


@dataclass(frozen=True)
class ToolContext:
    project_id: str
    user_id: str
    team_id: str | None = None
    canvas_id: str | None = None
    episode_id: str | None = None


_tool_ctx_var: contextvars.ContextVar[ToolContext | None] = contextvars.ContextVar(
    "_tool_ctx_var", default=None
)


def set_tool_context(
    project_id: str,
    user_id: str,
    team_id: str | None = None,
    canvas_id: str | None = None,
    episode_id: str | None = None,
) -> contextvars.Token:
    """Set tool context for current async task. Returns token for reset.

    MUST be called inside the request's async context before agent.run().
    """
    return _tool_ctx_var.set(
        ToolContext(
            project_id=project_id,
            user_id=user_id,
            team_id=team_id,
            canvas_id=canvas_id,
            episode_id=episode_id,
        )
    )


def get_tool_context() -> ToolContext:
    """Retrieve the current tool context. Raises RuntimeError if not set."""
    ctx = _tool_ctx_var.get()
    if ctx is None:
        raise RuntimeError("Tool context not set — call set_tool_context() before agent run")
    return ctx


def clear_tool_context() -> None:
    """Reset tool context to None (cleanup after agent run)."""
    _tool_ctx_var.set(None)


def get_context_snapshot() -> contextvars.Context:
    """Snapshot current context for safe propagation across async boundaries.

    Usage: ctx = get_context_snapshot(); ctx.run(some_function)
    Prevents contextvars loss when crossing asyncio.create_task() boundaries.
    """
    return contextvars.copy_context()
