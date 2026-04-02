"""Read tools — 7 LangChain @tool functions for querying project data.

SECURITY: Each tool enforces project_id ownership via get_tool_context() —
the agent cannot trick tools into returning cross-project data.
"""
from __future__ import annotations

import json
import logging

from langchain_core.tools import tool
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Input schemas (Pydantic BaseModel → LLM sees JSON schema)
# ---------------------------------------------------------------------------

class ProjectIdInput(BaseModel):
    project_id: str = Field(description="Project ID to query")


class EpisodeIdInput(BaseModel):
    episode_id: str = Field(description="Episode ID to query")


class CanvasIdInput(BaseModel):
    canvas_id: str = Field(description="Canvas ID to query")


# ---------------------------------------------------------------------------
# Read tools
# ---------------------------------------------------------------------------

@tool(args_schema=ProjectIdInput)
async def get_characters(project_id: str) -> str:
    """Get all characters in a project with their names and descriptions."""
    from app.core.database import AsyncSessionLocal
    try:
        async with AsyncSessionLocal() as db:
            from app.models.character import Character
            from sqlalchemy import select

            stmt = select(Character).where(
                Character.project_id == project_id,
                Character.is_deleted == False,  # noqa: E712
            )
            result = await db.execute(stmt)
            chars = result.scalars().all()
            return json.dumps(
                [{"id": c.id, "name": c.name, "description": c.description or ""} for c in chars],
                ensure_ascii=False,
            )
    except Exception as exc:
        logger.warning("get_characters failed: %s", exc)
        return json.dumps({"error": str(exc)[:200]}, ensure_ascii=False)


@tool(args_schema=ProjectIdInput)
async def get_scenes(project_id: str) -> str:
    """Get all scenes in a project with their names and descriptions."""
    from app.core.database import AsyncSessionLocal
    try:
        async with AsyncSessionLocal() as db:
            from app.models.scene import Scene
            from sqlalchemy import select

            stmt = select(Scene).where(
                Scene.project_id == project_id,
                Scene.is_deleted == False,  # noqa: E712
            )
            result = await db.execute(stmt)
            scenes = result.scalars().all()
            return json.dumps(
                [{"id": s.id, "name": s.name, "description": s.description or ""} for s in scenes],
                ensure_ascii=False,
            )
    except Exception as exc:
        logger.warning("get_scenes failed: %s", exc)
        return json.dumps({"error": str(exc)[:200]}, ensure_ascii=False)


@tool(args_schema=EpisodeIdInput)
async def get_script(episode_id: str) -> str:
    """Get the script content for a specific episode. Validates project ownership."""
    from app.agent.tool_context import get_tool_context
    from app.core.database import AsyncSessionLocal
    try:
        ctx = get_tool_context()
        async with AsyncSessionLocal() as db:
            from app.models.episode import Episode
            from app.models.script import Script
            from sqlalchemy import select

            episode = await db.get(Episode, episode_id)
            if not episode:
                return json.dumps({"error": "剧集不存在"}, ensure_ascii=False)
            if str(episode.project_id) != str(ctx.project_id):
                logger.warning(
                    "Auth guard: episode %s project_id=%s != ctx.project_id=%s",
                    episode_id, episode.project_id, ctx.project_id,
                )
                return json.dumps({"error": "无权访问该剧集"}, ensure_ascii=False)

            stmt = select(Script).where(Script.episode_id == episode_id)
            result = await db.execute(stmt)
            script = result.scalar_one_or_none()
            if not script:
                return json.dumps({"error": "该剧集暂无剧本"}, ensure_ascii=False)
            return json.dumps(
                {"episode_id": episode_id, "content": script.content or ""},
                ensure_ascii=False,
            )
    except Exception as exc:
        logger.warning("get_script failed: %s", exc)
        return json.dumps({"error": str(exc)[:200]}, ensure_ascii=False)


@tool(args_schema=CanvasIdInput)
async def get_canvas_state(canvas_id: str) -> str:
    """Get the current canvas state including nodes and edges. Validates project ownership."""
    from app.agent.tool_context import get_tool_context
    from app.core.database import AsyncSessionLocal
    try:
        ctx = get_tool_context()
        async with AsyncSessionLocal() as db:
            from app.models.canvas import Canvas
            from sqlalchemy import select
            from sqlalchemy.orm import selectinload

            stmt = (
                select(Canvas)
                .options(selectinload(Canvas.nodes), selectinload(Canvas.edges))
                .where(Canvas.id == canvas_id)
            )
            result = await db.execute(stmt)
            canvas = result.scalar_one_or_none()
            if not canvas:
                return json.dumps({"error": "画布不存在"}, ensure_ascii=False)
            if str(canvas.project_id) != str(ctx.project_id):
                logger.warning(
                    "Auth guard: canvas %s project_id=%s != ctx.project_id=%s",
                    canvas_id, canvas.project_id, ctx.project_id,
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
        return json.dumps({"error": str(exc)[:200]}, ensure_ascii=False)


@tool(args_schema=ProjectIdInput)
async def get_project_info(project_id: str) -> str:
    """Get project metadata: name, description, synopsis, total episodes."""
    from app.core.database import AsyncSessionLocal
    try:
        async with AsyncSessionLocal() as db:
            from app.models.project import Project

            project = await db.get(Project, project_id)
            if not project:
                return json.dumps({"error": "项目不存在"}, ensure_ascii=False)
            return json.dumps(
                {
                    "id": project.id,
                    "name": project.name,
                    "description": project.description or "",
                    "global_style": project.global_style or "",
                    "aspect_ratio": project.aspect_ratio or "16:9",
                },
                ensure_ascii=False,
            )
    except Exception as exc:
        logger.warning("get_project_info failed: %s", exc)
        return json.dumps({"error": str(exc)[:200]}, ensure_ascii=False)


@tool(args_schema=ProjectIdInput)
async def get_episodes(project_id: str) -> str:
    """Get all episodes in a project, ordered by episode number."""
    from app.core.database import AsyncSessionLocal
    try:
        async with AsyncSessionLocal() as db:
            from app.models.episode import Episode
            from sqlalchemy import select

            stmt = (
                select(Episode)
                .where(
                    Episode.project_id == project_id,
                    Episode.is_deleted == False,  # noqa: E712
                )
                .order_by(Episode.episode_number)
            )
            result = await db.execute(stmt)
            episodes = result.scalars().all()
            return json.dumps(
                [
                    {
                        "id": e.id,
                        "title": e.title,
                        "episode_number": e.episode_number,
                        "synopsis": e.synopsis or "",
                    }
                    for e in episodes
                ],
                ensure_ascii=False,
            )
    except Exception as exc:
        logger.warning("get_episodes failed: %s", exc)
        return json.dumps({"error": str(exc)[:200]}, ensure_ascii=False)


@tool(args_schema=ProjectIdInput)
async def get_style_templates(project_id: str) -> str:
    """Get style templates for a project."""
    from app.core.database import AsyncSessionLocal
    try:
        async with AsyncSessionLocal() as db:
            from app.models.style_template import StyleTemplate
            from sqlalchemy import select

            stmt = select(StyleTemplate).where(StyleTemplate.project_id == project_id)
            result = await db.execute(stmt)
            templates = result.scalars().all()
            return json.dumps(
                [
                    {
                        "id": t.id,
                        "name": t.name,
                        "style_type": t.style_type,
                        "description": getattr(t, "description", "") or "",
                    }
                    for t in templates
                ],
                ensure_ascii=False,
            )
    except Exception as exc:
        logger.warning("get_style_templates failed: %s", exc)
        return json.dumps({"error": str(exc)[:200]}, ensure_ascii=False)


CONTEXT_TOOLS = [
    get_characters,
    get_scenes,
    get_script,
    get_canvas_state,
    get_project_info,
    get_episodes,
    get_style_templates,
]
