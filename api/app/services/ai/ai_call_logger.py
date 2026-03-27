"""
Fail-open AICallLog writer.

Writes to the ai_call_logs table on every provider call.
On failure the exception is logged and swallowed — provider responses are never blocked.
"""
import logging
from contextvars import ContextVar
from decimal import Decimal
from typing import Any

logger = logging.getLogger(__name__)

_ai_call_ctx: ContextVar[dict[str, Any]] = ContextVar("ai_call_ctx", default={})


def set_ai_call_context(
    *,
    trace_id: str,
    user_id: str,
    team_id: str | None = None,
    project_id: str | None = None,
    skill_execution_id: str | None = None,
) -> None:
    """Set ContextVar values that log_ai_call reads automatically."""
    _ai_call_ctx.set({
        "trace_id": trace_id,
        "user_id": user_id,
        "team_id": team_id,
        "project_id": project_id,
        "skill_execution_id": skill_execution_id,
    })


def get_ai_call_context() -> dict[str, Any]:
    return _ai_call_ctx.get()


async def log_ai_call(
    *,
    provider: str,
    model: str,
    model_type: str = "llm",
    input_tokens: int | None = None,
    output_tokens: int | None = None,
    duration_ms: int = 0,
    status: str = "success",
    error_message: str | None = None,
    cost: Decimal | None = None,
    **extra: Any,
) -> None:
    """Write to AICallLog table. FAIL-OPEN: exceptions are logged and swallowed."""
    try:
        from app.core.database import AsyncSessionLocal
        from app.models.ai_call_log import AICallLog

        ctx = get_ai_call_context()
        log_entry = AICallLog(
            trace_id=ctx.get("trace_id", ""),
            skill_execution_id=ctx.get("skill_execution_id"),
            user_id=ctx.get("user_id", ""),
            team_id=ctx.get("team_id"),
            project_id=ctx.get("project_id"),
            provider=provider,
            model=model,
            model_type=model_type,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            duration_ms=duration_ms,
            status=status,
            error_message=error_message[:2000] if error_message else None,
            cost=cost,
            credential_source="env",
        )
        async with AsyncSessionLocal() as session:
            session.add(log_entry)
            await session.commit()
    except Exception:
        logger.exception("FAIL-OPEN: AICallLog write failed (provider=%s model=%s)", provider, model)
