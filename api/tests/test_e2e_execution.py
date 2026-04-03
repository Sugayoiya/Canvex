"""E2E tests for skill and canvas API endpoints.

Post-Phase 13: all remaining SkillRegistry handlers are deprecated.
Reasoning skills live in SKILL.md and are loaded by SkillLoader for the
LangChain agent.
"""
import uuid

import pytest


@pytest.mark.asyncio
async def test_skill_invoke_endpoint(async_client):
    """Invoke a skill via the API endpoint (may fail without provider but endpoint should respond)."""
    resp = await async_client.post("/api/v1/skills/invoke", json={
        "skill_name": "visual.generate_image",
        "params": {"prompt": "Hello world"},
        "project_id": "test-project-id",
    })
    assert resp.status_code != 404, "Skill invoke endpoint should exist"


@pytest.mark.asyncio
async def test_skill_list_endpoint(async_client):
    """List all registered skills via the API."""
    resp = await async_client.get("/api/v1/skills/")
    assert resp.status_code == 200
    skills = resp.json()
    assert isinstance(skills, list)
    assert skills == []


@pytest.mark.asyncio
async def test_skill_tool_definitions(async_client):
    """Get skills as OpenAI tool definitions."""
    resp = await async_client.get("/api/v1/skills/tools")
    assert resp.status_code == 200
    tools = resp.json()
    assert isinstance(tools, list)
    assert tools == []


@pytest.mark.asyncio
async def test_contextvar_propagation():
    """Verify ContextVar trace_id set/get works for AI call logging."""
    from app.services.ai.ai_call_logger import set_ai_call_context, get_ai_call_context

    test_trace_id = f"test-trace-{uuid.uuid4().hex[:8]}"
    test_user_id = "ctx-test-user"

    set_ai_call_context(
        trace_id=test_trace_id,
        user_id=test_user_id,
        team_id=None,
        project_id="ctx-test-project",
    )
    ctx = get_ai_call_context()
    assert ctx["trace_id"] == test_trace_id
    assert ctx["user_id"] == test_user_id
    assert ctx["project_id"] == "ctx-test-project"


@pytest.mark.asyncio
async def test_canvas_to_skill_flow(async_client):
    """E2E: verify canvas endpoints + skill endpoints are both reachable and consistent."""
    canvas_resp = await async_client.get("/api/v1/canvas/", params={"project_id": "e2e-test"})
    assert canvas_resp.status_code in (200, 404)

    skills_resp = await async_client.get("/api/v1/skills/")
    assert skills_resp.status_code == 200
    skills = skills_resp.json()
    assert skills == []


@pytest.mark.asyncio
async def test_skill_invoke_unknown_skill(async_client):
    """Invoking a non-existent skill should return error status or HTTP error."""
    resp = await async_client.post("/api/v1/skills/invoke", json={
        "skill_name": "nonexistent.skill",
        "params": {},
        "project_id": "test-project-id",
    })
    if resp.status_code == 200:
        data = resp.json()
        assert data.get("status") == "failed", \
            f"Unknown skill should return failed status, got: {data}"
    else:
        assert resp.status_code in (404, 422, 500)
