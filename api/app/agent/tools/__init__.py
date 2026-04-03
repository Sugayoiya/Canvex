"""Tool aggregation and context-aware gating."""

TOOL_METADATA = {
    "get_project_info": {
        "skill_tier": "meta",
        "skill_kind": "get_project_info",
        "is_read_only": True,
        "is_destructive": False,
        "timeout": 60,
        "max_result_size_chars": 50000,
        "context_group": "always",
    },
    "get_episodes": {
        "skill_tier": "meta",
        "skill_kind": "get_episodes",
        "is_read_only": True,
        "is_destructive": False,
        "timeout": 60,
        "max_result_size_chars": 50000,
        "context_group": "always",
    },
    "get_characters": {
        "skill_tier": "meta",
        "skill_kind": "get_characters",
        "is_read_only": True,
        "is_destructive": False,
        "timeout": 60,
        "max_result_size_chars": 50000,
        "context_group": "always",
    },
    "get_scenes": {
        "skill_tier": "meta",
        "skill_kind": "get_scenes",
        "is_read_only": True,
        "is_destructive": False,
        "timeout": 60,
        "max_result_size_chars": 50000,
        "context_group": "always",
    },
    "get_script": {
        "skill_tier": "meta",
        "skill_kind": "get_script",
        "is_read_only": True,
        "is_destructive": False,
        "timeout": 60,
        "max_result_size_chars": 50000,
        "context_group": "always",
    },
    "get_canvas_state": {
        "skill_tier": "meta",
        "skill_kind": "get_canvas_state",
        "is_read_only": True,
        "is_destructive": False,
        "timeout": 60,
        "max_result_size_chars": 50000,
        "context_group": "canvas",
    },
    "get_style_templates": {
        "skill_tier": "meta",
        "skill_kind": "get_style_templates",
        "is_read_only": True,
        "is_destructive": False,
        "timeout": 60,
        "max_result_size_chars": 50000,
        "context_group": "episode",
    },
    "save_characters": {
        "skill_tier": "capability",
        "skill_kind": "save_characters",
        "is_read_only": False,
        "is_destructive": False,
        "timeout": 60,
        "max_result_size_chars": 50000,
        "context_group": "script",
    },
    "save_scenes": {
        "skill_tier": "capability",
        "skill_kind": "save_scenes",
        "is_read_only": False,
        "is_destructive": False,
        "timeout": 60,
        "max_result_size_chars": 50000,
        "context_group": "script",
    },
    "save_screenplay": {
        "skill_tier": "capability",
        "skill_kind": "save_screenplay",
        "is_read_only": False,
        "is_destructive": True,
        "timeout": 60,
        "max_result_size_chars": 50000,
        "context_group": "script",
    },
    "save_shot_plan": {
        "skill_tier": "capability",
        "skill_kind": "save_shot_plan",
        "is_read_only": False,
        "is_destructive": True,
        "timeout": 60,
        "max_result_size_chars": 50000,
        "context_group": "episode",
    },
    "save_shot_details": {
        "skill_tier": "capability",
        "skill_kind": "save_shot_details",
        "is_read_only": False,
        "is_destructive": False,
        "timeout": 60,
        "max_result_size_chars": 50000,
        "context_group": "episode",
    },
    "update_shot": {
        "skill_tier": "capability",
        "skill_kind": "update_shot",
        "is_read_only": False,
        "is_destructive": False,
        "timeout": 60,
        "max_result_size_chars": 50000,
        "context_group": "episode",
    },
    "generate_image": {
        "skill_tier": "capability",
        "skill_kind": "generate_image",
        "is_read_only": False,
        "is_destructive": False,
        "timeout": 120,
        "max_result_size_chars": 5000,
        "context_group": "episode",
    },
    "generate_video": {
        "skill_tier": "capability",
        "skill_kind": "generate_video",
        "is_read_only": False,
        "is_destructive": False,
        "timeout": 120,
        "max_result_size_chars": 5000,
        "context_group": "episode",
    },
    "read_skill": {
        "skill_tier": "meta",
        "skill_kind": "read_skill",
        "is_read_only": True,
        "is_destructive": False,
        "timeout": 10,
        "max_result_size_chars": 100000,
        "context_group": "always",
    },
    "read_resource": {
        "skill_tier": "meta",
        "skill_kind": "read_resource",
        "is_read_only": True,
        "is_destructive": False,
        "timeout": 10,
        "max_result_size_chars": 100000,
        "context_group": "always",
    },
}


def _attach_tool_metadata(tools: list) -> list:
    """Attach Phase 13 metadata dicts to LangChain StructuredTool objects."""
    for tool in tools:
        meta = TOOL_METADATA.get(tool.name)
        if meta:
            tool.metadata = {**(getattr(tool, "metadata", None) or {}), **meta}
    return tools


def get_all_tools() -> list:
    """Return all 17 tools (unfiltered). Use get_tools_for_context() for agent invocation."""
    from app.agent.tools.context_tools import CONTEXT_TOOLS
    from app.agent.tools.mutation_tools import MUTATION_TOOLS
    from app.agent.tools.ai_tools import AI_TOOLS
    from app.agent.tools.skill_tools import SKILL_TOOLS
    tools = [*CONTEXT_TOOLS, *MUTATION_TOOLS, *AI_TOOLS, *SKILL_TOOLS]
    return _attach_tool_metadata(tools)


def get_tools_for_context(*, has_canvas: bool = False, has_episode: bool = False) -> list:
    """Return context-gated tool subset (≤14 tools). Use this for agent creation."""
    from app.agent.tool_middleware import get_tools_for_context as _gate
    return _gate(get_all_tools(), has_canvas=has_canvas, has_episode=has_episode)
