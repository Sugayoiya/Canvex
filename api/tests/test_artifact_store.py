"""Unit tests for AgentArtifact model, ArtifactStoreService, and ToolContext extensions."""
from __future__ import annotations

import contextvars

import pytest

from app.agent.artifact_store import SUMMARY_TEMPLATES, generate_summary
from app.agent.tool_context import (
    ToolContext,
    get_tool_context,
    reset_tool_context,
    set_tool_context,
    set_tool_context_obj,
)
from app.models.agent_artifact import AgentArtifact


# ---------------------------------------------------------------------------
# AgentArtifact model tests
# ---------------------------------------------------------------------------


def test_artifact_model_table_name() -> None:
    assert AgentArtifact.__tablename__ == "agent_artifacts"


def test_artifact_model_fields() -> None:
    columns = {c.name for c in AgentArtifact.__table__.columns}
    expected = {
        "id",
        "session_id",
        "skill_kind",
        "summary",
        "payload",
        "execution_log_id",
        "created_at",
    }
    assert expected.issubset(columns), f"Missing columns: {expected - columns}"


def test_artifact_model_indexes() -> None:
    index_names = {idx.name for idx in AgentArtifact.__table__.indexes}
    assert "ix_agent_artifacts_session_kind" in index_names
    assert "ix_agent_artifacts_session_created" in index_names


# ---------------------------------------------------------------------------
# generate_summary tests
# ---------------------------------------------------------------------------


def test_generate_summary_known_kinds() -> None:
    assert generate_summary("save_characters", {"characters": [1, 2, 3]}) == "已保存 3 个角色"
    assert generate_summary("save_scenes", {"scenes": [1]}) == "已保存 1 个场景"
    assert "图片已生成" in generate_summary("generate_image", {"url": "https://example.com/img.png"})


def test_generate_summary_unknown_kind_fallback() -> None:
    result = generate_summary("unknown_skill", {"key": "value"})
    assert "key" in result
    assert "value" in result


def test_generate_summary_truncation() -> None:
    huge_payload = {"data": "x" * 2000}
    result = generate_summary("unknown_skill", huge_payload)
    assert len(result) <= 500


def test_summary_templates_coverage() -> None:
    assert len(SUMMARY_TEMPLATES) >= 8


# ---------------------------------------------------------------------------
# ToolContext extension tests
# ---------------------------------------------------------------------------


def test_tool_context_session_id() -> None:
    ctx = ToolContext(project_id="p1", user_id="u1", session_id="s1")
    assert ctx.session_id == "s1"


def test_tool_context_session_id_default_none() -> None:
    ctx = ToolContext(project_id="p1", user_id="u1")
    assert ctx.session_id is None


def test_set_tool_context_with_session_id() -> None:
    token = set_tool_context(project_id="p1", user_id="u1", session_id="s1")
    try:
        ctx = get_tool_context()
        assert ctx.session_id == "s1"
        assert ctx.project_id == "p1"
    finally:
        reset_tool_context(token)


def test_reset_tool_context() -> None:
    token_outer = set_tool_context(project_id="p1", user_id="u1")
    token_inner = set_tool_context(project_id="p2", user_id="u2", session_id="s2")
    assert get_tool_context().project_id == "p2"
    reset_tool_context(token_inner)
    assert get_tool_context().project_id == "p1"
    reset_tool_context(token_outer)


def test_set_tool_context_obj() -> None:
    import dataclasses

    original_ctx = ToolContext(project_id="p1", user_id="u1", session_id="s1")
    token_orig = set_tool_context_obj(original_ctx)

    modified = dataclasses.replace(original_ctx, session_id="s2")
    token_mod = set_tool_context_obj(modified)
    assert get_tool_context().session_id == "s2"

    reset_tool_context(token_mod)
    assert get_tool_context().session_id == "s1"
    reset_tool_context(token_orig)
