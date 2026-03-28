"""SkillRegistry → PydanticAI AbstractToolset bridge.

Translates SkillDescriptors from the registry into PydanticAI ToolDefinition
objects so the Agent can discover and invoke Skills through the unified
SkillRegistry.invoke() path (preserving billing/logging chain).
"""
from __future__ import annotations

import asyncio
import json
import logging
import random
from typing import Any

from pydantic_ai.tools import ToolDefinition, RunContext
from pydantic_ai.toolsets import AbstractToolset, ToolsetTool
from pydantic_core import SchemaValidator, core_schema

from app.skills.context import SkillContext
from app.skills.descriptor import SkillDescriptor
from app.skills.registry import SkillRegistry

logger = logging.getLogger(__name__)

_PERMISSIVE_VALIDATOR = SchemaValidator(core_schema.any_schema())


class SkillToolset(AbstractToolset):
    """Bridges SkillRegistry descriptors into PydanticAI tools.

    Category__skill double-underscore namespacing prevents collisions
    (e.g. text.llm_generate → text__llm_generate).
    """

    def __init__(
        self,
        registry: SkillRegistry,
        context: SkillContext,
        categories: list[str] | None = None,
        toolset_id: str | None = None,
    ) -> None:
        self._registry = registry
        self._context = context
        self._categories = categories
        self._toolset_id = toolset_id or "skill_toolset"

        self._cancelled = False
        self._tools: dict[str, SkillDescriptor] = {}
        self._original_names: dict[str, str] = {}
        self._completed_results: list[dict[str, Any]] = []
        self._build_tool_map()

    @property
    def id(self) -> str | None:
        return self._toolset_id

    def _build_tool_map(self) -> None:
        descriptors = self._registry.discover(category=None)

        if self._categories:
            upper_cats = {c.upper() for c in self._categories}
            descriptors = [d for d in descriptors if d.category.value in upper_cats]

        seen: dict[str, str] = {}
        for desc in descriptors:
            safe_name = f"{desc.category.value.lower()}__{desc.name.split('.')[-1]}"
            if safe_name in seen:
                raise ValueError(
                    f"Duplicate safe_name '{safe_name}' for skills "
                    f"'{seen[safe_name]}' and '{desc.name}'"
                )
            seen[safe_name] = desc.name
            self._tools[safe_name] = desc
            self._original_names[safe_name] = desc.name

    async def get_tools(self, ctx: RunContext) -> dict[str, ToolsetTool]:
        result: dict[str, ToolsetTool] = {}
        for safe_name, desc in self._tools.items():
            tool_def = ToolDefinition(
                name=safe_name,
                description=desc.description,
                parameters_json_schema=desc.input_schema or {"type": "object", "properties": {}},
            )
            result[safe_name] = ToolsetTool(
                toolset=self,
                tool_def=tool_def,
                max_retries=1,
                args_validator=_PERMISSIVE_VALIDATOR,
            )
        return result

    async def call_tool(
        self,
        name: str,
        tool_args: dict[str, Any],
        ctx: RunContext,
        tool: ToolsetTool,
    ) -> Any:
        if name not in self._tools:
            return json.dumps({"error": f"Unknown tool: {name}"}, ensure_ascii=False)

        original_name = self._original_names[name]
        desc = self._tools[name]

        try:
            if desc.execution_mode == "sync":
                result = await self._registry.invoke(original_name, tool_args, self._context)
            else:
                result = await self._poll_async(original_name, tool_args, desc)

            self._completed_results.append({
                "tool": name,
                "status": result.status,
                "data": result.data if hasattr(result, "data") else {},
                "message": result.message if hasattr(result, "message") else "",
            })
            return json.dumps(result.to_dict(), ensure_ascii=False)

        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.exception("Tool call failed: %s", name)
            self._completed_results.append({
                "tool": name,
                "status": "failed",
                "data": {},
                "message": str(exc),
            })
            return json.dumps(
                {"error": str(exc), "tool": name}, ensure_ascii=False
            )

    async def _poll_async(
        self,
        skill_name: str,
        params: dict[str, Any],
        desc: SkillDescriptor,
    ):
        submit_result = await self._registry.invoke(skill_name, params, self._context)
        task_id = submit_result.task_id
        if not task_id:
            return submit_result

        timeout = getattr(desc, "timeout", 120) or 120
        elapsed = 0.0
        base = 1.0
        iteration = 0

        while elapsed < timeout:
            if self._cancelled:
                return submit_result

            current_task = asyncio.current_task()
            if current_task and current_task.cancelled():
                raise asyncio.CancelledError()

            interval = min(base * (1.5 ** iteration), 10) * random.uniform(0.8, 1.2)
            await asyncio.sleep(interval)
            elapsed += interval
            iteration += 1

            poll_result = await self._registry.poll(task_id)
            if poll_result.status in ("completed", "failed"):
                return poll_result

        return type(submit_result)(
            status="failed",
            task_id=task_id,
            message="Tool execution timed out",
            data={"error": "Tool execution timed out", "task_id": task_id},
        )

    def pop_completed_results(self) -> list[dict[str, Any]]:
        results = self._completed_results[:]
        self._completed_results.clear()
        return results

    def cancel(self) -> None:
        self._cancelled = True

    async def tool_names(self) -> list[str]:
        return sorted(self._tools.keys())

    async def tool_defs(self) -> list[ToolDefinition]:
        """Convenience method — returns flat list of ToolDefinitions."""
        return [
            ToolDefinition(
                name=safe_name,
                description=desc.description,
                parameters_json_schema=desc.input_schema or {"type": "object", "properties": {}},
            )
            for safe_name, desc in self._tools.items()
        ]
