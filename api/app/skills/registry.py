from __future__ import annotations

import logging
from typing import Any, Callable, Awaitable

from app.skills.descriptor import SkillDescriptor, SkillCategory, SkillResult
from app.skills.context import SkillContext

logger = logging.getLogger(__name__)

SkillHandler = Callable[[dict[str, Any], SkillContext], Awaitable[SkillResult]]


class SkillRegistry:
    """Central registry — Agent / canvas nodes / API all invoke Skills through here."""

    def __init__(self) -> None:
        self._skills: dict[str, tuple[SkillDescriptor, SkillHandler]] = {}

    def register(self, descriptor: SkillDescriptor, handler: SkillHandler) -> None:
        if descriptor.name in self._skills:
            logger.warning("Skill '%s' is being re-registered", descriptor.name)
        self._skills[descriptor.name] = (descriptor, handler)
        logger.info("Registered skill: %s [%s]", descriptor.name, descriptor.category.value)

    def get(self, name: str) -> tuple[SkillDescriptor, SkillHandler]:
        if name not in self._skills:
            raise KeyError(f"Skill '{name}' not found in registry")
        return self._skills[name]

    def get_descriptor(self, name: str) -> SkillDescriptor:
        return self.get(name)[0]

    def discover(self, category: str | SkillCategory | None = None) -> list[SkillDescriptor]:
        results = []
        for descriptor, _ in self._skills.values():
            if category is None:
                results.append(descriptor)
            else:
                cat = category if isinstance(category, str) else category.value
                if descriptor.category.value == cat:
                    results.append(descriptor)
        return results

    def to_tool_definitions(self, category: str | None = None) -> list[dict[str, Any]]:
        """Convert registered Skills into OpenAI Tool Calling function definitions."""
        return [d.to_tool_definition() for d in self.discover(category)]

    async def invoke(self, name: str, params: dict[str, Any], context: SkillContext) -> SkillResult:
        """
        Unified invocation entry:
        - sync skill: directly await handler
        - async_celery skill: submit to Celery, return task_id
        """
        descriptor, handler = self.get(name)

        if descriptor.execution_mode == "sync":
            logger.info("Invoking sync skill: %s (trace=%s)", name, context.trace_id)
            return await handler(params, context)

        # async_celery: dispatch via Celery
        from app.tasks.skill_task import run_skill_task

        logger.info(
            "Submitting async skill to Celery: %s queue=%s (trace=%s)",
            name, descriptor.celery_queue, context.trace_id,
        )
        task = run_skill_task.apply_async(
            args=[name, params, context.to_dict()],
            queue=descriptor.celery_queue,
        )
        return SkillResult.running(task_id=task.id, message=f"Skill '{descriptor.display_name}' 已提交")

    async def poll(self, task_id: str) -> SkillResult:
        """Query async Skill execution progress."""
        from app.celery_app import celery_app

        result = celery_app.AsyncResult(task_id)

        if result.state == "PENDING":
            return SkillResult(status="queued", task_id=task_id, message="排队中", progress=0.0)
        elif result.state == "STARTED" or result.state == "RETRY":
            return SkillResult(status="running", task_id=task_id, message="执行中", progress=0.3)
        elif result.state == "SUCCESS":
            data = result.result or {}
            if isinstance(data, dict):
                return SkillResult.from_dict(data)
            return SkillResult(status="completed", task_id=task_id, data={"raw": data})
        elif result.state == "FAILURE":
            return SkillResult.failed(message=str(result.result), error_code="CELERY_FAILURE")
        else:
            return SkillResult(status="running", task_id=task_id, message=f"状态: {result.state}", progress=0.5)

    @property
    def skill_count(self) -> int:
        return len(self._skills)

    def list_names(self) -> list[str]:
        return sorted(self._skills.keys())


# Singleton instance
skill_registry = SkillRegistry()
