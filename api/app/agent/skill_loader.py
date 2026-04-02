"""Skill loader — three-level progressive disclosure for Anthropic SKILL.md directories."""
import logging
import threading
import yaml
from pathlib import Path
from typing import NamedTuple

logger = logging.getLogger(__name__)

MAX_PIPELINE_DEPTH = 3


class SkillMeta(NamedTuple):
    name: str
    description: str
    path: Path


class SkillLoader:
    """Three-level progressive disclosure for Anthropic SKILL.md directories.

    L1: Metadata (YAML frontmatter) — loaded at startup, cached, injected into system prompt.
    L2: Body (Markdown after frontmatter) — loaded on demand via read_skill().
    L3: Resources (files in skill directory) — loaded on demand via read_resource().

    Cache invalidation: mtime-based. Call reload_if_changed() to re-scan directories
    whose SKILL.md mtime has changed since last load.
    """

    def __init__(self, skills_dir: Path | None = None):
        self.skills_dir = skills_dir or (Path(__file__).parent / "skills")
        self._metadata: dict[str, SkillMeta] = {}
        self._mtimes: dict[str, float] = {}
        self._lock = threading.Lock()

    def load_metadata(self) -> list[SkillMeta]:
        """L1: Parse YAML frontmatter from all SKILL.md files at startup."""
        with self._lock:
            self._metadata.clear()
            self._mtimes.clear()
            if not self.skills_dir.exists():
                logger.warning("Skills directory not found: %s", self.skills_dir)
                return []
            for skill_dir in sorted(self.skills_dir.iterdir()):
                if not skill_dir.is_dir():
                    continue
                skill_md = skill_dir / "SKILL.md"
                if not skill_md.exists():
                    continue
                try:
                    meta = self._parse_frontmatter(skill_md)
                    self._metadata[meta.name] = meta
                    self._mtimes[meta.name] = skill_md.stat().st_mtime
                    logger.debug("Loaded skill metadata: %s", meta.name)
                except Exception:
                    logger.exception(
                        "Failed to parse SKILL.md: %s — skipping (tolerant mode)",
                        skill_md,
                    )
            logger.info("SkillLoader: loaded %d skill(s)", len(self._metadata))
            return list(self._metadata.values())

    def reload_if_changed(self) -> int:
        """Check all SKILL.md mtimes and reload any that changed. Returns count of reloaded skills."""
        reloaded = 0
        with self._lock:
            if not self.skills_dir.exists():
                return 0
            for skill_dir in sorted(self.skills_dir.iterdir()):
                if not skill_dir.is_dir():
                    continue
                skill_md = skill_dir / "SKILL.md"
                if not skill_md.exists():
                    continue
                current_mtime = skill_md.stat().st_mtime
                name_guess = skill_dir.name
                cached_mtime = self._mtimes.get(name_guess, 0)
                if current_mtime != cached_mtime:
                    try:
                        meta = self._parse_frontmatter(skill_md)
                        self._metadata[meta.name] = meta
                        self._mtimes[meta.name] = current_mtime
                        reloaded += 1
                        logger.info("Reloaded skill: %s (mtime changed)", meta.name)
                    except Exception:
                        logger.exception("Failed to reload SKILL.md: %s", skill_md)
        return reloaded

    def build_system_prompt_fragment(self) -> str:
        """Build 'Available Skills' section for system prompt from L1 cache."""
        with self._lock:
            if not self._metadata:
                return ""
            lines = [
                "## 可用技能\n",
                "使用 `read_skill(name)` 获取技能详细指令后再执行。\n",
            ]
            for m in self._metadata.values():
                lines.append(f"- **{m.name}**: {m.description}")
            return "\n".join(lines)

    def read_skill(self, name: str) -> str:
        """L2: Return full SKILL.md body (Markdown after frontmatter)."""
        skill_md = self.skills_dir / name / "SKILL.md"
        if not skill_md.exists():
            return f"Skill '{name}' not found."
        content = skill_md.read_text(encoding="utf-8")
        if content.startswith("---"):
            try:
                end = content.index("---", 3)
                return content[end + 3 :].strip()
            except ValueError:
                return content
        return content

    def read_resource(self, name: str, filename: str) -> str:
        """L3: Return content of a specific resource file in skill directory."""
        resource = (self.skills_dir / name / filename).resolve()
        if not str(resource).startswith(str(self.skills_dir.resolve())):
            return "Error: invalid path"
        if not resource.exists():
            return f"Resource '{filename}' not found in skill '{name}'."
        return resource.read_text(encoding="utf-8")

    def list_skills(self) -> list[dict]:
        """Return list of {name, description} for API listing."""
        with self._lock:
            return [
                {"name": m.name, "description": m.description}
                for m in self._metadata.values()
            ]

    def _parse_frontmatter(self, path: Path) -> SkillMeta:
        """Parse YAML frontmatter between --- delimiters. Tolerant: warns on missing optional fields."""
        text = path.read_text(encoding="utf-8")
        if not text.startswith("---"):
            raise ValueError(f"No YAML frontmatter in {path}")
        end = text.index("---", 3)
        fm = yaml.safe_load(text[3:end])
        if not isinstance(fm, dict) or "name" not in fm:
            raise ValueError(f"Invalid frontmatter (missing 'name') in {path}")
        description = fm.get("description", "")
        if isinstance(description, str):
            description = description.strip()
        else:
            description = str(description).strip()
        return SkillMeta(
            name=fm["name"],
            description=description,
            path=path.parent,
        )
