"""Tool aggregation and context-aware gating."""


def get_all_tools() -> list:
    """Return all 17 tools (unfiltered). Use get_tools_for_context() for agent invocation."""
    from app.agent.tools.context_tools import CONTEXT_TOOLS
    from app.agent.tools.mutation_tools import MUTATION_TOOLS
    from app.agent.tools.ai_tools import AI_TOOLS
    from app.agent.tools.skill_tools import SKILL_TOOLS
    return [*CONTEXT_TOOLS, *MUTATION_TOOLS, *AI_TOOLS, *SKILL_TOOLS]


def get_tools_for_context(*, has_canvas: bool = False, has_episode: bool = False) -> list:
    """Return context-gated tool subset (≤14 tools). Use this for agent creation."""
    from app.agent.tool_middleware import get_tools_for_context as _gate
    return _gate(get_all_tools(), has_canvas=has_canvas, has_episode=has_episode)
