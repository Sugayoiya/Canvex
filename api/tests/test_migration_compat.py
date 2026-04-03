"""Migration compatibility tests for Phase 12.1 PydanticAI → LangChain transition.

Test matrix:
1. Old PydanticAI message history → new agent loads empty (graceful degradation)
2. New LangChain message history → loads correctly
3. App startup without pydantic_ai installed → no ImportError
4. Canvas skill invocation still works (generate_image, generate_video registered)
"""
import json
import pytest


@pytest.mark.asyncio
async def test_old_pydantic_history_returns_empty():
    """Sessions with only pydantic_ai_messages_json should return empty history."""
    from app.agent.agent_service import AgentService
    from unittest.mock import AsyncMock, MagicMock

    service = AgentService()
    mock_db = AsyncMock()

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_result)

    history = await service.load_message_history(mock_db, "test-session-id")
    assert history == [], "Old PydanticAI history should return empty list"


@pytest.mark.asyncio
async def test_new_langchain_history_loads():
    """Sessions with langchain_messages_json should load correctly."""
    from app.agent.agent_service import AgentService
    from langchain_core.messages import messages_to_dict, HumanMessage, AIMessage
    from unittest.mock import AsyncMock, MagicMock

    test_messages = [HumanMessage(content="你好"), AIMessage(content="你好！")]
    serialized = json.dumps(messages_to_dict(test_messages))

    service = AgentService()
    mock_db = AsyncMock()

    mock_msg = MagicMock(langchain_messages_json=serialized)
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_msg
    mock_db.execute = AsyncMock(return_value=mock_result)

    history = await service.load_message_history(mock_db, "test-session-id")
    assert len(history) == 2, f"Expected 2 messages, got {len(history)}"
    assert history[0].content == "你好"
    assert history[1].content == "你好！"


def test_no_pydantic_ai_imports():
    """Verify no pydantic_ai imports remain in app code."""
    import ast
    from pathlib import Path

    app_dir = Path(__file__).parent.parent / "app"
    violations = []
    for py_file in app_dir.rglob("*.py"):
        try:
            tree = ast.parse(py_file.read_text())
            for node in ast.walk(tree):
                if isinstance(node, (ast.Import, ast.ImportFrom)):
                    module = node.module if isinstance(node, ast.ImportFrom) else None
                    names = [a.name for a in node.names] if isinstance(node, ast.Import) else []
                    if module and "pydantic_ai" in module:
                        violations.append(f"{py_file}:{node.lineno} imports {module}")
                    for name in names:
                        if "pydantic_ai" in name:
                            violations.append(f"{py_file}:{node.lineno} imports {name}")
        except SyntaxError:
            pass
    assert not violations, f"PydanticAI imports found:\n" + "\n".join(violations)


def test_canvas_skills_available_via_langchain_tools():
    """Verify canvas generation moved from SkillRegistry to LangChain tools."""
    from app.agent.tools import get_all_tools
    from app.skills.registry import skill_registry
    from app.skills.register_all import register_all_skills

    register_all_skills()
    assert skill_registry.list_names() == []

    tool_names = [tool.name for tool in get_all_tools()]
    assert "generate_image" in tool_names
    assert "generate_video" in tool_names
