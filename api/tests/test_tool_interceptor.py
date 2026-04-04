"""Tests for ToolInterceptor before/after hooks, summary return, recursive backfill."""
import json

import pytest
from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field
from unittest.mock import AsyncMock, MagicMock, patch


class DummyInput(BaseModel):
    text: str = Field(default="hello")


def _make_dummy_tool(name="dummy_tool", return_val='{"result": "ok"}'):
    async def _fn(**kwargs):
        return return_val

    return StructuredTool(
        name=name,
        description="test",
        args_schema=DummyInput,
        coroutine=_fn,
        metadata={},
    )


# ── Double-wrap prevention ──────────────────────────────────────────────


def test_wrap_prevents_double_wrapping():
    from app.agent.tool_interceptor import _INTERCEPTOR_WRAPPED, wrap_tool_with_interceptor

    tool = _make_dummy_tool()
    wrapped = wrap_tool_with_interceptor(tool, {"dummy_tool": {"skill_kind": "test"}})
    assert getattr(wrapped, _INTERCEPTOR_WRAPPED, False) is True
    wrapped2 = wrap_tool_with_interceptor(wrapped, {"dummy_tool": {"skill_kind": "test"}})
    assert wrapped2 is wrapped


# ── _parse_tool_result ──────────────────────────────────────────────────


def test_parse_tool_result_valid_json():
    from app.agent.tool_interceptor import _parse_tool_result

    assert _parse_tool_result('{"key": "val"}') == {"key": "val"}


def test_parse_tool_result_invalid_json():
    from app.agent.tool_interceptor import _parse_tool_result

    result = _parse_tool_result("not json")
    assert result == {"raw": "not json"}


def test_parse_tool_result_non_dict():
    from app.agent.tool_interceptor import _parse_tool_result

    result = _parse_tool_result("[1, 2, 3]")
    assert result == {"raw": [1, 2, 3]}


# ── After-hook ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_after_hook_persists_artifact():
    from app.agent.tool_interceptor import wrap_tool_with_interceptor

    tool = _make_dummy_tool(return_val='{"characters": ["Alice", "Bob"]}')
    metadata = {"dummy_tool": {"skill_kind": "save_characters"}}

    mock_artifact = MagicMock(id="art-123")
    with (
        patch(
            "app.agent.tool_context.get_tool_context",
            return_value=MagicMock(session_id="sess-1", injected_artifacts=None),
        ),
        patch(
            "app.agent.artifact_store.ArtifactStoreService.save",
            new_callable=AsyncMock,
            return_value=mock_artifact,
        ),
        patch(
            "app.agent.artifact_store.generate_summary",
            return_value="已保存 2 个角色",
        ),
    ):
        wrapped = wrap_tool_with_interceptor(tool, metadata)
        result = await wrapped.coroutine(text="test")
        parsed = json.loads(result)
        assert parsed["artifact_id"] == "art-123"
        assert "已保存" in parsed["summary"]


@pytest.mark.asyncio
async def test_after_hook_skips_on_error():
    from app.agent.tool_interceptor import wrap_tool_with_interceptor

    tool = _make_dummy_tool(return_val='{"error": "something failed"}')
    metadata = {"dummy_tool": {"skill_kind": "generate_image"}}

    with patch(
        "app.agent.tool_context.get_tool_context",
        return_value=MagicMock(session_id="sess-1", injected_artifacts=None),
    ):
        wrapped = wrap_tool_with_interceptor(tool, metadata)
        result = await wrapped.coroutine(text="test")
        parsed = json.loads(result)
        assert "error" in parsed


@pytest.mark.asyncio
async def test_after_hook_extracts_log_id():
    from app.agent.tool_interceptor import wrap_tool_with_interceptor

    tool = _make_dummy_tool(return_val='{"log_id": "log-99", "url": "http://img.png"}')
    metadata = {"dummy_tool": {"skill_kind": "generate_image"}}

    mock_artifact = MagicMock(id="art-456")
    with (
        patch(
            "app.agent.tool_context.get_tool_context",
            return_value=MagicMock(session_id="sess-1", injected_artifacts=None),
        ),
        patch(
            "app.agent.artifact_store.ArtifactStoreService.save",
            new_callable=AsyncMock,
            return_value=mock_artifact,
        ) as mock_save,
        patch("app.agent.artifact_store.generate_summary", return_value="图片已生成"),
    ):
        wrapped = wrap_tool_with_interceptor(tool, metadata)
        await wrapped.coroutine(text="test")
        call_kwargs = mock_save.call_args[1]
        assert call_kwargs["execution_log_id"] == "log-99"
        assert "log_id" not in call_kwargs["payload"]


# ── Before-hook ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_before_hook_injects_via_tool_context():
    from app.agent.tool_context import ToolContext
    from app.agent.tool_interceptor import wrap_tool_with_interceptor

    real_ctx = ToolContext(
        project_id="p1", user_id="u1", session_id="sess-2"
    )

    async def _capturing_fn(**kwargs):
        return '{"result": "ok"}'

    tool = StructuredTool(
        name="downstream_tool",
        description="test",
        args_schema=DummyInput,
        coroutine=_capturing_fn,
        metadata={},
    )
    metadata = {
        "downstream_tool": {
            "skill_kind": "downstream",
            "require_prior_kind": ["upstream_kind"],
        },
    }

    with (
        patch(
            "app.agent.tool_context.get_tool_context",
            return_value=real_ctx,
        ),
        patch(
            "app.agent.tool_context.set_tool_context_obj",
        ) as mock_set,
        patch("app.agent.tool_context.reset_tool_context"),
        patch(
            "app.agent.artifact_store.ArtifactStoreService.get_latest_payload",
            new_callable=AsyncMock,
            return_value={"data": "from_upstream"},
        ),
        patch(
            "app.agent.artifact_store.ArtifactStoreService.save",
            new_callable=AsyncMock,
            return_value=MagicMock(id="art-456"),
        ),
        patch("app.agent.artifact_store.generate_summary", return_value="result"),
    ):
        mock_set.return_value = "token"
        wrapped = wrap_tool_with_interceptor(tool, metadata)
        await wrapped.coroutine(text="hello")
        mock_set.assert_called_once()
        new_ctx_arg = mock_set.call_args[0][0]
        assert new_ctx_arg.injected_artifacts == {
            "upstream_kind": {"data": "from_upstream"}
        }


# ── No session_id ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_no_session_id_skips_hooks():
    from app.agent.tool_interceptor import wrap_tool_with_interceptor

    tool = _make_dummy_tool(return_val='{"plain": "result"}')
    metadata = {
        "dummy_tool": {"skill_kind": "test", "require_prior_kind": ["dep"]}
    }

    with patch(
        "app.agent.tool_context.get_tool_context",
        return_value=MagicMock(session_id=None, injected_artifacts=None),
    ):
        wrapped = wrap_tool_with_interceptor(tool, metadata)
        result = await wrapped.coroutine(text="test")
        assert result == '{"plain": "result"}'


# ── System prompt ───────────────────────────────────────────────────────


def test_system_prompt_contains_artifact_guidance():
    from app.agent.context_builder import build_system_prompt

    prompt = build_system_prompt()
    assert "自动" in prompt
    assert "数据传递" in prompt


# ── get_all_tools wrapping ──────────────────────────────────────────────


def test_get_all_tools_applies_interceptor():
    from app.agent.tool_interceptor import _INTERCEPTOR_WRAPPED
    from app.agent.tools import get_all_tools

    tools = get_all_tools()
    assert len(tools) >= 17
    for t in tools:
        assert getattr(t, _INTERCEPTOR_WRAPPED, False) is True, (
            f"Tool {t.name} not wrapped"
        )


# ── Two-pass wrapping ──────────────────────────────────────────────────


def test_two_pass_wrapping_backfill_sees_wrapped_tools():
    from app.agent.tool_interceptor import (
        _INTERCEPTOR_WRAPPED,
        wrap_tool_with_interceptor,
    )

    wrapped_ref: list = []
    tool_a = _make_dummy_tool(name="tool_a", return_val='{"data": "a"}')
    tool_b = _make_dummy_tool(name="tool_b", return_val='{"data": "b"}')
    metadata = {
        "tool_a": {"skill_kind": "kind_a"},
        "tool_b": {"skill_kind": "kind_b", "require_prior_kind": ["kind_a"]},
    }
    wrapped = [
        wrap_tool_with_interceptor(t, metadata, wrapped_ref)
        for t in [tool_a, tool_b]
    ]
    wrapped_ref.extend(wrapped)

    assert len(wrapped_ref) == 2
    for t in wrapped_ref:
        assert getattr(t, _INTERCEPTOR_WRAPPED, False) is True
    assert wrapped_ref[0].name == "tool_a"
    assert wrapped_ref[1].name == "tool_b"


# ── _can_backfill_without_input ─────────────────────────────────────────


def test_can_backfill_without_input_all_defaults():
    from app.agent.tool_interceptor import _can_backfill_without_input

    tool = _make_dummy_tool()  # DummyInput.text has default="hello"
    assert _can_backfill_without_input(tool) is True


def test_can_backfill_without_input_required_params():
    from app.agent.tool_interceptor import _can_backfill_without_input

    class RequiredInput(BaseModel):
        prompt: str = Field(description="Required field, no default")

    async def _fn(**kwargs):
        return '{"result": "ok"}'

    tool = StructuredTool(
        name="required_tool",
        description="test",
        args_schema=RequiredInput,
        coroutine=_fn,
        metadata={},
    )
    assert _can_backfill_without_input(tool) is False


def test_can_backfill_without_input_no_schema():
    from app.agent.tool_interceptor import _can_backfill_without_input

    tool = MagicMock(spec=StructuredTool)
    tool.args_schema = None
    assert _can_backfill_without_input(tool) is True


# ── Recursive backfill safety ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_backfill_skips_required_param_tools():
    from app.agent.tool_interceptor import _inject_dependencies

    class RequiredInput(BaseModel):
        prompt: str = Field(description="Required, no default")

    async def _fn(**kwargs):
        return '{"result": "ok"}'

    required_tool = StructuredTool(
        name="required_tool",
        description="test",
        args_schema=RequiredInput,
        coroutine=_fn,
        metadata={},
    )
    metadata = {"required_tool": {"skill_kind": "required_kind"}}

    with patch(
        "app.agent.artifact_store.ArtifactStoreService.get_latest_payload",
        new_callable=AsyncMock,
        return_value=None,
    ):
        with pytest.raises(RuntimeError, match="必填参数"):
            await _inject_dependencies(
                session_id="sess-1",
                require_prior_kinds=["required_kind"],
                tool_metadata=metadata,
                all_tools=[required_tool],
                depth=0,
            )


@pytest.mark.asyncio
async def test_backfill_max_depth_exceeded():
    from app.agent.tool_interceptor import _inject_dependencies

    with pytest.raises(RuntimeError, match="最大深度"):
        await _inject_dependencies(
            session_id="sess-1",
            require_prior_kinds=["some_kind"],
            tool_metadata={},
            all_tools=[],
            depth=4,
        )


# ── produces_artifact=False ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_produces_artifact_false_skips_after_hook():
    from app.agent.tool_interceptor import wrap_tool_with_interceptor

    tool = _make_dummy_tool(name="get_info", return_val='{"characters": ["Alice"]}')
    metadata = {
        "get_info": {"skill_kind": "get_characters", "produces_artifact": False}
    }

    with (
        patch(
            "app.agent.tool_context.get_tool_context",
            return_value=MagicMock(session_id="sess-1", injected_artifacts=None),
        ),
        patch(
            "app.agent.artifact_store.ArtifactStoreService.save",
            new_callable=AsyncMock,
        ) as mock_save,
    ):
        wrapped = wrap_tool_with_interceptor(tool, metadata)
        result = await wrapped.coroutine(text="test")
        mock_save.assert_not_called()
        assert result == '{"characters": ["Alice"]}'


def test_tool_metadata_produces_artifact_flags():
    from app.agent.tools import TOOL_METADATA

    read_only_tools = [
        "get_project_info",
        "get_episodes",
        "get_characters",
        "get_scenes",
        "get_script",
        "get_canvas_state",
        "get_style_templates",
        "read_skill",
        "read_resource",
    ]
    for tool_name in read_only_tools:
        meta = TOOL_METADATA.get(tool_name, {})
        assert meta.get("produces_artifact") is False, (
            f"{tool_name} should have produces_artifact=False"
        )
    mutation_tools = ["save_characters", "generate_image"]
    for tool_name in mutation_tools:
        meta = TOOL_METADATA.get(tool_name, {})
        assert meta.get("produces_artifact", True) is True, (
            f"{tool_name} should produce artifacts"
        )
