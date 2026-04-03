from __future__ import annotations

from pathlib import Path

import yaml

from app.agent.tools import TOOL_METADATA, get_all_tools


SKILLS_ROOT = Path(__file__).resolve().parents[1] / "app" / "agent" / "skills"
REQUIRED_FIELDS = {
    "skill_kind",
    "skill_tier",
    "is_read_only",
    "is_destructive",
    "timeout",
    "max_result_size_chars",
}


def _load_frontmatter(path: Path) -> dict:
    content = path.read_text(encoding="utf-8")
    assert content.startswith("---"), f"{path} is missing YAML frontmatter"
    parts = content.split("---", 2)
    assert len(parts) >= 3, f"{path} has invalid frontmatter delimiters"
    data = yaml.safe_load(parts[1]) or {}
    assert isinstance(data, dict), f"{path} frontmatter must parse to a dict"
    return data


def _skill_metadata() -> dict[str, dict]:
    files = sorted(SKILLS_ROOT.glob("*/SKILL.md"))
    assert len(files) == 10
    return {path.parent.name: _load_frontmatter(path) for path in files}


def test_all_skill_md_have_frontmatter() -> None:
    metadata = _skill_metadata()
    for skill_name, frontmatter in metadata.items():
        missing = REQUIRED_FIELDS - frontmatter.keys()
        assert not missing, f"{skill_name} missing fields: {sorted(missing)}"


def test_skill_md_skill_kind_values() -> None:
    metadata = _skill_metadata()
    assert metadata["extract-characters"]["skill_kind"] == "extract_characters"
    assert metadata["episode-pipeline"]["skill_kind"] == "episode_pipeline"
    assert metadata["split-clips"]["skill_kind"] == "split_clips"


def test_skill_md_episode_pipeline_is_workflow() -> None:
    metadata = _skill_metadata()
    assert metadata["episode-pipeline"]["skill_tier"] == "workflow"


def test_all_tools_have_metadata() -> None:
    tools = get_all_tools()
    assert len(tools) == 17
    for tool in tools:
        assert tool.metadata
        assert "skill_tier" in tool.metadata
        assert "context_group" in tool.metadata


def test_tool_metadata_coverage() -> None:
    assert len(TOOL_METADATA) == 17


def test_meta_tools_are_read_only() -> None:
    meta_tools = [
        name
        for name, meta in TOOL_METADATA.items()
        if meta.get("skill_tier") == "meta"
    ]
    assert meta_tools
    for name in meta_tools:
        assert TOOL_METADATA[name]["is_read_only"] is True
