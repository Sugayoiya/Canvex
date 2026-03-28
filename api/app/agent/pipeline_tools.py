"""Pipeline tool — deterministic multi-step skill chains for agent use."""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.toolsets import FunctionToolset

from app.agent.agent_service import AgentDeps

logger = logging.getLogger(__name__)

STEP_CONFIG: dict[str, dict[str, Any]] = {
    "script.split_clips": {"timeout": 60, "retries": 1},
    "script.convert_screenplay": {"timeout": 60, "retries": 1},
    "storyboard.plan": {"timeout": 90, "retries": 0},
    "storyboard.detail": {"timeout": 90, "retries": 0},
}

EPISODE_PIPELINE_STEPS = list(STEP_CONFIG.keys())

_UNDERSCORE_TO_DOT = {k.replace(".", "_"): k for k in EPISODE_PIPELINE_STEPS}


def _resolve_step_name(name: str) -> str | None:
    if name in STEP_CONFIG:
        return name
    return _UNDERSCORE_TO_DOT.get(name)


def _chain_params(
    step: str, story_text: str, results: dict[str, dict]
) -> dict[str, Any]:
    """Build input params for *step* from previous step outputs."""
    if step == "script.split_clips":
        return {"text": story_text}
    if step == "script.convert_screenplay":
        prev = results.get("script.split_clips", {})
        return {"clips": prev.get("clips", [])}
    if step == "storyboard.plan":
        prev = results.get("script.convert_screenplay", {})
        return {"screenplay": prev.get("screenplay", "")}
    if step == "storyboard.detail":
        prev = results.get("storyboard.plan", {})
        return {"shot_plan": prev.get("shots", [])}
    return {}


async def run_episode_pipeline(
    ctx: RunContext[AgentDeps],
    story_text: str,
    steps: list[str] | None = None,
) -> str:
    """Execute a deterministic episode production pipeline.

    Steps: script splitting -> screenplay conversion -> storyboard planning -> storyboard detail.

    Args:
        story_text: The story/script text to process.
        steps: Optional list of step names to run. Accepts dotted (script.split_clips)
               or underscored (script_split_clips) names. Default: all steps in order.
    """
    requested = EPISODE_PIPELINE_STEPS
    if steps:
        resolved = []
        for s in steps:
            name = _resolve_step_name(s)
            if name is None:
                return json.dumps(
                    {"status": "failed", "error": f"Unknown step: {s}", "completed_steps": [], "results_summary": {}},
                    ensure_ascii=False,
                )
            resolved.append(name)
        requested = resolved

    results: dict[str, dict] = {}
    completed: list[str] = []

    for step in requested:
        cfg = STEP_CONFIG.get(step, {"timeout": 60, "retries": 0})
        params = _chain_params(step, story_text, results)
        retries_left = cfg["retries"]
        last_error: str | None = None

        while True:
            try:
                result = await asyncio.wait_for(
                    ctx.deps.registry.invoke(step, params, ctx.deps.skill_context),
                    timeout=cfg["timeout"],
                )
                if result.status == "failed":
                    last_error = result.message or "step failed"
                    if retries_left > 0:
                        retries_left -= 1
                        await asyncio.sleep(2)
                        continue
                    return json.dumps(
                        {
                            "status": "partial",
                            "completed_steps": completed,
                            "failed_step": step,
                            "error": last_error,
                            "results_summary": {k: _summarize(v) for k, v in results.items()},
                        },
                        ensure_ascii=False,
                    )
                results[step] = result.data or {}
                completed.append(step)
                break

            except asyncio.TimeoutError:
                last_error = f"Step '{step}' timed out after {cfg['timeout']}s"
                if retries_left > 0:
                    retries_left -= 1
                    await asyncio.sleep(2)
                    continue
                return json.dumps(
                    {
                        "status": "partial",
                        "completed_steps": completed,
                        "failed_step": step,
                        "error": last_error,
                        "results_summary": {k: _summarize(v) for k, v in results.items()},
                    },
                    ensure_ascii=False,
                )

            except asyncio.CancelledError:
                return json.dumps(
                    {
                        "status": "cancelled",
                        "completed_steps": completed,
                        "failed_step": step,
                        "error": "Pipeline cancelled",
                        "results_summary": {k: _summarize(v) for k, v in results.items()},
                    },
                    ensure_ascii=False,
                )

            except Exception as exc:
                last_error = str(exc)
                if retries_left > 0:
                    retries_left -= 1
                    await asyncio.sleep(2)
                    continue
                return json.dumps(
                    {
                        "status": "partial",
                        "completed_steps": completed,
                        "failed_step": step,
                        "error": last_error,
                        "results_summary": {k: _summarize(v) for k, v in results.items()},
                    },
                    ensure_ascii=False,
                )

    return json.dumps(
        {
            "status": "completed",
            "completed_steps": completed,
            "failed_step": None,
            "error": None,
            "results_summary": {k: _summarize(v) for k, v in results.items()},
        },
        ensure_ascii=False,
    )


def _summarize(data: dict) -> dict:
    """Produce a compact summary of step output data."""
    summary: dict[str, Any] = {}
    for key, val in data.items():
        if isinstance(val, list):
            summary[key] = f"[{len(val)} items]"
        elif isinstance(val, str) and len(val) > 200:
            summary[key] = val[:200] + "..."
        else:
            summary[key] = val
    return summary


def get_pipeline_toolset() -> FunctionToolset[AgentDeps]:
    """Return a FunctionToolset wrapping the episode pipeline tool."""
    toolset: FunctionToolset[AgentDeps] = FunctionToolset()
    toolset.tool(run_episode_pipeline)
    return toolset
