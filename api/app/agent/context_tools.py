"""Context query tools — let agent fetch project details on demand.

SECURITY: Each tool enforces project_id ownership internally — the agent
cannot trick tools into returning cross-project data by passing arbitrary IDs.
"""
from __future__ import annotations

import json
import logging

from pydantic_ai import RunContext
from pydantic_ai.toolsets import FunctionToolset
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.agent.agent_service import AgentDeps

logger = logging.getLogger(__name__)


async def get_project_characters(ctx: RunContext[AgentDeps]) -> str:
    """Get all characters in the current project with their names and descriptions.

    Returns a JSON array of character objects.
    """
    try:
        from app.models.character import Character

        stmt = select(Character).where(
            Character.project_id == ctx.deps.project_id,
            Character.is_deleted == False,  # noqa: E712
        )
        result = await ctx.deps.db.execute(stmt)
        chars = result.scalars().all()
        items = [
            {"id": c.id, "name": c.name, "description": c.description or ""}
            for c in chars
        ]
        return json.dumps(items, ensure_ascii=False)
    except Exception as exc:
        logger.warning("get_project_characters failed: %s", exc)
        return json.dumps({"error": "无法加载角色列表，请稍后重试"}, ensure_ascii=False)


async def get_project_scenes(ctx: RunContext[AgentDeps]) -> str:
    """Get all scenes in the current project with their names and descriptions.

    Returns a JSON array of scene objects.
    """
    try:
        from app.models.scene import Scene

        stmt = select(Scene).where(
            Scene.project_id == ctx.deps.project_id,
            Scene.is_deleted == False,  # noqa: E712
        )
        result = await ctx.deps.db.execute(stmt)
        scenes = result.scalars().all()
        items = [
            {"id": s.id, "name": s.name, "description": s.description or ""}
            for s in scenes
        ]
        return json.dumps(items, ensure_ascii=False)
    except Exception as exc:
        logger.warning("get_project_scenes failed: %s", exc)
        return json.dumps({"error": "无法加载场景列表，请稍后重试"}, ensure_ascii=False)


async def get_script_content(ctx: RunContext[AgentDeps], episode_id: str) -> str:
    """Get the script content for a specific episode.

    Args:
        episode_id: The episode ID to fetch script for.
    """
    try:
        from app.models.episode import Episode
        from app.models.script import Script

        episode = await ctx.deps.db.get(Episode, episode_id)
        if not episode:
            return json.dumps({"error": "剧集不存在"}, ensure_ascii=False)
        if str(episode.project_id) != str(ctx.deps.project_id):
            logger.warning(
                "Auth guard: episode %s project_id=%s != session project_id=%s",
                episode_id, episode.project_id, ctx.deps.project_id,
            )
            return json.dumps({"error": "无权访问该剧集"}, ensure_ascii=False)

        stmt = select(Script).where(Script.episode_id == episode_id)
        result = await ctx.deps.db.execute(stmt)
        script = result.scalar_one_or_none()
        if not script:
            return json.dumps({"error": "该剧集暂无剧本"}, ensure_ascii=False)
        return json.dumps(
            {"episode_id": episode_id, "content": script.content or ""},
            ensure_ascii=False,
        )
    except Exception as exc:
        logger.warning("get_script_content failed: %s", exc)
        return json.dumps({"error": "无法加载剧本内容，请稍后重试"}, ensure_ascii=False)


async def get_canvas_state(ctx: RunContext[AgentDeps]) -> str:
    """Get the current canvas state including all nodes and their statuses.

    Returns a JSON object with canvas info, nodes list, and edge connections.
    """
    if not ctx.deps.canvas_id:
        return json.dumps({"error": "当前会话未关联画布"}, ensure_ascii=False)

    try:
        from app.models.canvas import Canvas

        canvas_stmt = select(Canvas).options(
            selectinload(Canvas.nodes),
            selectinload(Canvas.edges),
        ).where(Canvas.id == ctx.deps.canvas_id)
        result = await ctx.deps.db.execute(canvas_stmt)
        canvas = result.scalar_one_or_none()
        if not canvas:
            return json.dumps({"error": "画布不存在"}, ensure_ascii=False)
        if str(canvas.project_id) != str(ctx.deps.project_id):
            logger.warning(
                "Auth guard: canvas %s project_id=%s != session project_id=%s",
                ctx.deps.canvas_id, canvas.project_id, ctx.deps.project_id,
            )
            return json.dumps({"error": "无权访问该画布"}, ensure_ascii=False)

        nodes_data = [
            {
                "id": n.id,
                "type": n.node_type,
                "status": n.status,
                "has_result": bool(n.result_text or n.result_url),
            }
            for n in canvas.nodes
        ]
        edges_data = [
            {"source": e.source_node_id, "target": e.target_node_id}
            for e in canvas.edges
        ]
        return json.dumps(
            {"canvas_id": canvas.id, "name": canvas.name, "nodes": nodes_data, "edges": edges_data},
            ensure_ascii=False,
        )
    except Exception as exc:
        logger.warning("get_canvas_state failed: %s", exc)
        return json.dumps({"error": "无法加载画布状态，请稍后重试"}, ensure_ascii=False)


def get_context_toolset() -> FunctionToolset[AgentDeps]:
    """Return a FunctionToolset with project/canvas context query tools."""
    toolset: FunctionToolset[AgentDeps] = FunctionToolset()
    toolset.tool(get_project_characters)
    toolset.tool(get_project_scenes)
    toolset.tool(get_script_content)
    toolset.tool(get_canvas_state)
    return toolset
