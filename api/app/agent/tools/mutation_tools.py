"""Write tools — 6 LangChain @tool functions for persisting project data.

Each tool opens its own AsyncSessionLocal, performs upsert logic, commits, and
returns a JSON summary. No shared DB session — each tool is fully self-contained.
"""
from __future__ import annotations

import json
import logging

from langchain_core.tools import tool
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Input schemas
# ---------------------------------------------------------------------------

class SaveCharactersInput(BaseModel):
    project_id: str = Field(description="Project ID")
    characters_json: str = Field(description='JSON array of characters: [{"name": "...", "description": "...", "gender": "...", "age": "...", "personality": "..."}]')


class SaveScenesInput(BaseModel):
    project_id: str = Field(description="Project ID")
    scenes_json: str = Field(description='JSON array of scenes: [{"name": "...", "description": "..."}]')


class SaveScreenplayInput(BaseModel):
    episode_id: str = Field(description="Episode ID")
    content: str = Field(description="Full screenplay text content")


class SaveShotPlanInput(BaseModel):
    episode_id: str = Field(description="Episode ID")
    shots_json: str = Field(description='JSON array of shots: [{"shot_number": 1, "description": "...", "characters": [...], "scene": "...", "dialogue": "..."}]')


class SaveShotDetailsInput(BaseModel):
    shot_id: str = Field(description="Shot ID to update")
    details_json: str = Field(description='JSON with detail fields: {"description": "...", "image_prompt": "...", "characters": "...", "scene": "...", "dialogue": "..."}')


class UpdateShotInput(BaseModel):
    shot_id: str = Field(description="Shot ID to update")
    field: str = Field(description="Field name to update (description, image_prompt, dialogue, scene)")
    value: str = Field(description="New value for the field")


# ---------------------------------------------------------------------------
# Write tools
# ---------------------------------------------------------------------------

@tool(args_schema=SaveCharactersInput)
async def save_characters(project_id: str, characters_json: str) -> str:
    """Save or update characters for a project. Upserts by name within the project."""
    from app.core.database import AsyncSessionLocal
    try:
        items = json.loads(characters_json)
        if not isinstance(items, list):
            return json.dumps({"error": "characters_json must be a JSON array"}, ensure_ascii=False)

        async with AsyncSessionLocal() as db:
            from app.models.character import Character
            from sqlalchemy import select

            saved, updated = 0, 0
            for item in items:
                name = item.get("name", "").strip()
                if not name:
                    continue

                stmt = select(Character).where(
                    Character.project_id == project_id,
                    Character.name == name,
                    Character.is_deleted == False,  # noqa: E712
                )
                result = await db.execute(stmt)
                existing = result.scalar_one_or_none()

                if existing:
                    for field in ("description", "gender", "age", "personality"):
                        if field in item and item[field] is not None:
                            setattr(existing, field, item[field])
                    updated += 1
                else:
                    char = Character(
                        project_id=project_id,
                        name=name,
                        description=item.get("description", ""),
                        gender=item.get("gender"),
                        age=item.get("age"),
                        personality=item.get("personality"),
                    )
                    db.add(char)
                    saved += 1

            await db.commit()
            return json.dumps({"saved": saved, "updated": updated}, ensure_ascii=False)
    except json.JSONDecodeError:
        return json.dumps({"error": "Invalid JSON in characters_json"}, ensure_ascii=False)
    except Exception as exc:
        logger.warning("save_characters failed: %s", exc)
        return json.dumps({"error": str(exc)[:200]}, ensure_ascii=False)


@tool(args_schema=SaveScenesInput)
async def save_scenes(project_id: str, scenes_json: str) -> str:
    """Save or update scenes for a project. Upserts by name within the project."""
    from app.core.database import AsyncSessionLocal
    try:
        items = json.loads(scenes_json)
        if not isinstance(items, list):
            return json.dumps({"error": "scenes_json must be a JSON array"}, ensure_ascii=False)

        async with AsyncSessionLocal() as db:
            from app.models.scene import Scene
            from sqlalchemy import select

            saved, updated = 0, 0
            for item in items:
                name = item.get("name", "").strip()
                if not name:
                    continue

                stmt = select(Scene).where(
                    Scene.project_id == project_id,
                    Scene.name == name,
                    Scene.is_deleted == False,  # noqa: E712
                )
                result = await db.execute(stmt)
                existing = result.scalar_one_or_none()

                if existing:
                    if "description" in item and item["description"] is not None:
                        existing.description = item["description"]
                    updated += 1
                else:
                    scene = Scene(
                        project_id=project_id,
                        name=name,
                        description=item.get("description", ""),
                    )
                    db.add(scene)
                    saved += 1

            await db.commit()
            return json.dumps({"saved": saved, "updated": updated}, ensure_ascii=False)
    except json.JSONDecodeError:
        return json.dumps({"error": "Invalid JSON in scenes_json"}, ensure_ascii=False)
    except Exception as exc:
        logger.warning("save_scenes failed: %s", exc)
        return json.dumps({"error": str(exc)[:200]}, ensure_ascii=False)


@tool(args_schema=SaveScreenplayInput)
async def save_screenplay(episode_id: str, content: str) -> str:
    """Save or update the screenplay for an episode. Validates project ownership."""
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
                return json.dumps({"error": "无权访问该剧集"}, ensure_ascii=False)

            stmt = select(Script).where(Script.episode_id == episode_id)
            result = await db.execute(stmt)
            script = result.scalar_one_or_none()

            if script:
                script.content = content
            else:
                script = Script(episode_id=episode_id, content=content)
                db.add(script)

            await db.commit()
            return json.dumps({"episode_id": episode_id, "length": len(content)}, ensure_ascii=False)
    except Exception as exc:
        logger.warning("save_screenplay failed: %s", exc)
        return json.dumps({"error": str(exc)[:200]}, ensure_ascii=False)


@tool(args_schema=SaveShotPlanInput)
async def save_shot_plan(episode_id: str, shots_json: str) -> str:
    """Create shot plan entries for an episode. Validates project ownership."""
    from app.agent.tool_context import get_tool_context
    from app.core.database import AsyncSessionLocal
    try:
        ctx = get_tool_context()
        items = json.loads(shots_json)
        if not isinstance(items, list):
            return json.dumps({"error": "shots_json must be a JSON array"}, ensure_ascii=False)

        async with AsyncSessionLocal() as db:
            from app.models.episode import Episode
            from app.models.shot import Shot

            episode = await db.get(Episode, episode_id)
            if not episode:
                return json.dumps({"error": "剧集不存在"}, ensure_ascii=False)
            if str(episode.project_id) != str(ctx.project_id):
                return json.dumps({"error": "无权访问该剧集"}, ensure_ascii=False)

            created = 0
            for item in items:
                shot = Shot(
                    episode_id=episode_id,
                    shot_number=item.get("shot_number", created + 1),
                    description=item.get("description", ""),
                    characters=json.dumps(item.get("characters", []), ensure_ascii=False),
                    scene=item.get("scene", ""),
                    dialogue=item.get("dialogue", ""),
                )
                db.add(shot)
                created += 1

            await db.commit()
            return json.dumps({"created": created}, ensure_ascii=False)
    except json.JSONDecodeError:
        return json.dumps({"error": "Invalid JSON in shots_json"}, ensure_ascii=False)
    except Exception as exc:
        logger.warning("save_shot_plan failed: %s", exc)
        return json.dumps({"error": str(exc)[:200]}, ensure_ascii=False)


@tool(args_schema=SaveShotDetailsInput)
async def save_shot_details(shot_id: str, details_json: str) -> str:
    """Update detailed fields on an existing shot."""
    from app.core.database import AsyncSessionLocal
    try:
        details = json.loads(details_json)
        if not isinstance(details, dict):
            return json.dumps({"error": "details_json must be a JSON object"}, ensure_ascii=False)

        allowed_fields = {"description", "image_prompt", "characters", "scene", "dialogue"}

        async with AsyncSessionLocal() as db:
            from app.models.shot import Shot

            shot = await db.get(Shot, shot_id)
            if not shot:
                return json.dumps({"error": "镜头不存在"}, ensure_ascii=False)

            updated_fields = []
            for field, value in details.items():
                if field in allowed_fields and value is not None:
                    if field == "characters" and isinstance(value, list):
                        value = json.dumps(value, ensure_ascii=False)
                    setattr(shot, field, value)
                    updated_fields.append(field)

            await db.commit()
            return json.dumps({"shot_id": shot_id, "updated_fields": updated_fields}, ensure_ascii=False)
    except json.JSONDecodeError:
        return json.dumps({"error": "Invalid JSON in details_json"}, ensure_ascii=False)
    except Exception as exc:
        logger.warning("save_shot_details failed: %s", exc)
        return json.dumps({"error": str(exc)[:200]}, ensure_ascii=False)


@tool(args_schema=UpdateShotInput)
async def update_shot(shot_id: str, field: str, value: str) -> str:
    """Update a single field on a shot. Allowed fields: description, image_prompt, dialogue, scene."""
    from app.core.database import AsyncSessionLocal
    allowed = {"description", "image_prompt", "dialogue", "scene"}
    if field not in allowed:
        return json.dumps(
            {"error": f"Field '{field}' not allowed. Use one of: {', '.join(sorted(allowed))}"},
            ensure_ascii=False,
        )
    try:
        async with AsyncSessionLocal() as db:
            from app.models.shot import Shot

            shot = await db.get(Shot, shot_id)
            if not shot:
                return json.dumps({"error": "镜头不存在"}, ensure_ascii=False)

            setattr(shot, field, value)
            await db.commit()
            return json.dumps({"shot_id": shot_id, "field": field, "success": True}, ensure_ascii=False)
    except Exception as exc:
        logger.warning("update_shot failed: %s", exc)
        return json.dumps({"error": str(exc)[:200]}, ensure_ascii=False)


MUTATION_TOOLS = [
    save_characters,
    save_scenes,
    save_screenplay,
    save_shot_plan,
    save_shot_details,
    update_shot,
]
