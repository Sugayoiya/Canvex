"""Skill tools — 2 LangChain @tool functions for reading skill definitions and resources.

Provides L2 (SKILL.md body) and L3 (resource file) loading for the agent.
Resource reads are capped at 100KB to prevent context overflow.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path

from langchain_core.tools import tool
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

RESOURCE_MAX_BYTES = 100_000

_SKILLS_DIR = Path(__file__).parent.parent / "skills"


class ReadSkillInput(BaseModel):
    name: str = Field(description="Skill name (directory name under api/app/agent/skills/)")


class ReadResourceInput(BaseModel):
    name: str = Field(description="Skill name (directory name)")
    filename: str = Field(description="Resource filename within the skill directory")


@tool(args_schema=ReadSkillInput)
async def read_skill(name: str) -> str:
    """Read the detailed instructions for a specific skill (SKILL.md body, frontmatter stripped)."""
    skill_md = _SKILLS_DIR / name / "SKILL.md"
    if not skill_md.exists():
        return json.dumps({"error": f"Skill '{name}' not found"}, ensure_ascii=False)
    try:
        content = skill_md.read_text(encoding="utf-8")
        if content.startswith("---"):
            try:
                end = content.index("---", 3)
                return content[end + 3:].strip()
            except ValueError:
                pass
        return content
    except Exception as exc:
        logger.warning("read_skill failed for '%s': %s", name, exc)
        return json.dumps({"error": str(exc)[:200]}, ensure_ascii=False)


@tool(args_schema=ReadResourceInput)
async def read_resource(name: str, filename: str) -> str:
    """Read a specific resource file from a skill directory (max 100KB). Path traversal is blocked."""
    resource = (_SKILLS_DIR / name / filename).resolve()
    if not str(resource).startswith(str(_SKILLS_DIR.resolve())):
        return json.dumps({"error": "Invalid path — traversal blocked"}, ensure_ascii=False)
    if not resource.exists():
        return json.dumps({"error": f"Resource '{filename}' not found in skill '{name}'"}, ensure_ascii=False)
    try:
        size = resource.stat().st_size
        if size > RESOURCE_MAX_BYTES:
            return json.dumps(
                {"error": f"Resource too large ({size} bytes, max {RESOURCE_MAX_BYTES})"},
                ensure_ascii=False,
            )
        return resource.read_text(encoding="utf-8")
    except Exception as exc:
        logger.warning("read_resource failed for '%s/%s': %s", name, filename, exc)
        return json.dumps({"error": str(exc)[:200]}, ensure_ascii=False)


SKILL_TOOLS = [read_skill, read_resource]
