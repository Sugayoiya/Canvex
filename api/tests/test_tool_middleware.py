from __future__ import annotations

from dataclasses import dataclass, field

from app.agent.tool_middleware import get_tools_for_context
from app.agent.tools import TOOL_METADATA


@dataclass
class MockTool:
    name: str
    metadata: dict = field(default_factory=dict)


def _build_mock_tools() -> list[MockTool]:
    return [MockTool(name=name, metadata=meta.copy()) for name, meta in TOOL_METADATA.items()]


def _tool_names(*, has_canvas: bool, has_episode: bool) -> list[str]:
    tools = get_tools_for_context(
        _build_mock_tools(),
        has_canvas=has_canvas,
        has_episode=has_episode,
    )
    return [tool.name for tool in tools]


def test_default_context_no_canvas_no_episode() -> None:
    names = _tool_names(has_canvas=False, has_episode=False)
    assert len(names) == 10
    assert names == [
        "get_project_info",
        "get_episodes",
        "get_characters",
        "get_scenes",
        "get_script",
        "save_characters",
        "save_scenes",
        "save_screenplay",
        "read_skill",
        "read_resource",
    ]
    assert "get_canvas_state" not in names
    assert "generate_image" not in names
    assert "generate_video" not in names


def test_episode_context() -> None:
    names = _tool_names(has_canvas=False, has_episode=True)
    assert len(names) == 13
    assert "generate_image" in names
    assert "generate_video" in names
    assert "save_shot_plan" in names
    assert "save_shot_details" in names
    assert "update_shot" in names
    assert "get_style_templates" in names
    assert "save_characters" not in names
    assert "save_scenes" not in names
    assert "save_screenplay" not in names


def test_canvas_context() -> None:
    names = _tool_names(has_canvas=True, has_episode=False)
    assert len(names) == 11
    assert "get_canvas_state" in names
    assert "save_characters" in names
    assert "save_scenes" in names
    assert "save_screenplay" in names


def test_both_context() -> None:
    names = _tool_names(has_canvas=True, has_episode=True)
    assert len(names) == 14
    assert "get_canvas_state" in names
    assert "generate_image" in names
    assert "generate_video" in names
    assert "save_characters" not in names
    assert "save_scenes" not in names
    assert "save_screenplay" not in names


def test_max_tool_count_respected() -> None:
    assert len(_tool_names(has_canvas=False, has_episode=False)) <= 14
    assert len(_tool_names(has_canvas=True, has_episode=False)) <= 14
    assert len(_tool_names(has_canvas=False, has_episode=True)) <= 14
    assert len(_tool_names(has_canvas=True, has_episode=True)) <= 14


def test_tool_without_metadata_defaults_to_always() -> None:
    tools = _build_mock_tools()
    tools.append(MockTool(name="fallback_tool", metadata={}))
    names = [tool.name for tool in get_tools_for_context(tools, has_canvas=False, has_episode=False)]
    assert "fallback_tool" in names


def test_tools_preserve_order() -> None:
    tools = [
        MockTool(name="custom-script", metadata={"context_group": "script"}),
        MockTool(name="custom-always", metadata={"context_group": "always"}),
        MockTool(name="custom-canvas", metadata={"context_group": "canvas"}),
        MockTool(name="custom-episode", metadata={"context_group": "episode"}),
    ]

    default_names = [tool.name for tool in get_tools_for_context(tools, has_canvas=False, has_episode=False)]
    assert default_names == ["custom-script", "custom-always"]

    episode_names = [tool.name for tool in get_tools_for_context(tools, has_canvas=True, has_episode=True)]
    assert episode_names == ["custom-always", "custom-canvas", "custom-episode"]
