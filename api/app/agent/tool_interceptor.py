"""ToolInterceptor: StructuredTool wrapper for automatic artifact injection/persistence.

Wraps each LangChain @tool with before/after hooks:
- Before: inject upstream dependency artifacts from ArtifactStore, stored on
  ToolContext.injected_artifacts via contextvars (NOT passed as kwargs — tool
  functions have fixed Pydantic-based signatures that reject unexpected keyword
  arguments)
- After: persist tool results to ArtifactStore, return summary+artifact_id to LLM
"""
from __future__ import annotations

import json
import logging
import time
from dataclasses import replace
from typing import Any

from langchain_core.tools import StructuredTool

logger = logging.getLogger(__name__)

MAX_BACKFILL_DEPTH = 3
_INTERCEPTOR_WRAPPED = "_interceptor_wrapped"


def wrap_tool_with_interceptor(
    tool: StructuredTool,
    tool_metadata: dict[str, dict],
    all_tools: list[StructuredTool] | None = None,
) -> StructuredTool:
    """Wrap a LangChain StructuredTool with before/after artifact hooks."""
    if getattr(tool, _INTERCEPTOR_WRAPPED, False):
        return tool

    meta = tool_metadata.get(tool.name, {})
    skill_kind = meta.get("skill_kind", "")
    require_prior = meta.get("require_prior_kind", [])
    produces_artifact = meta.get("produces_artifact", True)

    original_coroutine = tool.coroutine

    async def intercepted_fn(**kwargs: Any) -> str:
        from app.agent.artifact_store import ArtifactStoreService, generate_summary
        from app.agent.tool_context import get_tool_context, reset_tool_context, set_tool_context_obj

        start = time.monotonic()
        ctx = get_tool_context()
        session_id = ctx.session_id
        prev_token = None

        # --- BEFORE HOOK: inject upstream dependencies via ToolContext ---
        if require_prior and session_id:
            try:
                injected = await _inject_dependencies(
                    session_id=session_id,
                    require_prior_kinds=require_prior,
                    tool_metadata=tool_metadata,
                    all_tools=all_tools or [],
                    depth=0,
                )
                new_ctx = replace(ctx, injected_artifacts=injected)
                prev_token = set_tool_context_obj(new_ctx)
            except RuntimeError as e:
                logger.warning("Dependency injection failed for %s: %s", tool.name, e)
                return json.dumps(
                    {"error": f"前置依赖缺失: {e}"},
                    ensure_ascii=False,
                )

        try:
            result_str = await original_coroutine(**kwargs)
        finally:
            if prev_token is not None:
                reset_tool_context(prev_token)

        # --- AFTER HOOK: persist result as artifact ---
        if skill_kind and session_id and produces_artifact:
            try:
                payload = _parse_tool_result(result_str)
                if "error" not in payload:
                    summary = generate_summary(skill_kind, payload)
                    execution_log_id = payload.pop("log_id", None)
                    artifact = await ArtifactStoreService.save(
                        session_id=session_id,
                        skill_kind=skill_kind,
                        summary=summary,
                        payload=payload,
                        execution_log_id=execution_log_id,
                    )
                    artifact_id = artifact.id
                    duration_ms = int((time.monotonic() - start) * 1000)
                    logger.info(
                        "Artifact saved: skill=%s artifact_id=%s duration=%dms",
                        skill_kind, artifact_id, duration_ms,
                    )
                    return json.dumps(
                        {"summary": summary, "artifact_id": artifact_id},
                        ensure_ascii=False,
                    )
            except Exception:
                logger.exception("After-hook failed for %s", tool.name)

        return result_str

    wrapped = StructuredTool(
        name=tool.name,
        description=tool.description,
        args_schema=tool.args_schema,
        coroutine=intercepted_fn,
        metadata=tool.metadata,
    )
    setattr(wrapped, _INTERCEPTOR_WRAPPED, True)
    return wrapped


def _parse_tool_result(result_str: str) -> dict:
    """Parse JSON string returned by tools into dict for JSONB storage."""
    try:
        parsed = json.loads(result_str)
        if isinstance(parsed, dict):
            return parsed
        return {"raw": parsed}
    except (json.JSONDecodeError, TypeError):
        return {"raw": result_str}


async def _inject_dependencies(
    *,
    session_id: str,
    require_prior_kinds: list[str],
    tool_metadata: dict[str, dict],
    all_tools: list[StructuredTool],
    depth: int = 0,
) -> dict[str, dict]:
    """Inject upstream artifacts. Recursive backfill if missing (max depth 3)."""
    from app.agent.artifact_store import ArtifactStoreService

    if depth > MAX_BACKFILL_DEPTH:
        raise RuntimeError(
            f"依赖回填超过最大深度 ({MAX_BACKFILL_DEPTH})，请先手动执行前置步骤"
        )

    injected: dict[str, dict] = {}
    for kind in require_prior_kinds:
        payload = await ArtifactStoreService.get_latest_payload(session_id, kind)
        if payload is not None:
            injected[kind] = payload
            continue

        backfill_tool = _find_tool_by_kind(kind, tool_metadata, all_tools)
        if backfill_tool is None:
            raise RuntimeError(f"没有工具能产出 artifact 类型 '{kind}'")

        if not _can_backfill_without_input(backfill_tool):
            raise RuntimeError(
                f"工具 '{backfill_tool.name}' 有必填参数，无法自动补跑。"
                f"请先手动执行 {backfill_tool.name} 提供所需数据"
            )

        await backfill_tool.ainvoke({})

        payload = await ArtifactStoreService.get_latest_payload(session_id, kind)
        if payload is None:
            raise RuntimeError(
                f"回填 '{kind}' 执行成功但未找到 artifact（前置步骤可能需要用户输入）"
            )
        injected[kind] = payload

    return injected


def _find_tool_by_kind(
    kind: str,
    tool_metadata: dict[str, dict],
    all_tools: list[StructuredTool],
) -> StructuredTool | None:
    """Find a tool that produces the given skill_kind artifact."""
    for tool_name, meta in tool_metadata.items():
        if meta.get("skill_kind") == kind:
            for t in all_tools:
                if t.name == tool_name:
                    return t
    return None


def _can_backfill_without_input(tool: StructuredTool) -> bool:
    """Check if a tool can be safely backfilled with ainvoke({}).

    Inspects args_schema.model_fields to verify ALL fields have defaults.
    Tools with required parameters (e.g. generate_image needs 'prompt')
    CANNOT be auto-backfilled.
    """
    if not hasattr(tool, "args_schema") or tool.args_schema is None:
        return True
    for _field_name, field_info in tool.args_schema.model_fields.items():
        if field_info.is_required():
            return False
    return True
