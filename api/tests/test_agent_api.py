"""Integration tests for Agent API — session CRUD, SSE protocol, SkillToolset, pipeline."""
import json
import uuid

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import FakeUser


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def test_project(db_session: AsyncSession):
    """Create a minimal Project row so resolve_project_access succeeds."""
    from app.models.project import Project

    project = Project(
        id=str(uuid.uuid4()),
        name="Agent Test Project",
        owner_type="personal",
        owner_id=FakeUser.id,
        created_by=FakeUser.id,
    )
    db_session.add(project)
    await db_session.flush()
    await db_session.refresh(project)
    return project


@pytest_asyncio.fixture
async def test_session(async_client, test_project):
    """Create an agent session via the API and return the response body."""
    resp = await async_client.post(
        "/api/v1/agent/sessions",
        json={
            "project_id": test_project.id,
            "title": "Test Session",
            "model_name": "gemini-2.5-flash",
            "provider": "gemini",
        },
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


# ---------------------------------------------------------------------------
# TestAgentSessionCRUD
# ---------------------------------------------------------------------------


class TestAgentSessionCRUD:
    @pytest.mark.asyncio
    async def test_create_session(self, async_client, test_project):
        resp = await async_client.post(
            "/api/v1/agent/sessions",
            json={
                "project_id": test_project.id,
                "title": "New Session",
                "model_name": "gemini-2.5-flash",
                "provider": "gemini",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "New Session"
        assert data["status"] == "active"
        assert data["model_name"] == "gemini-2.5-flash"
        assert data["provider"] == "gemini"
        assert "id" in data

    @pytest.mark.asyncio
    async def test_list_sessions(self, async_client, test_project, test_session):
        resp = await async_client.get(
            "/api/v1/agent/sessions",
            params={"project_id": test_project.id},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "sessions" in data
        assert "total" in data
        assert data["total"] >= 1
        ids = [s["id"] for s in data["sessions"]]
        assert test_session["id"] in ids

    @pytest.mark.asyncio
    async def test_get_session(self, async_client, test_session):
        resp = await async_client.get(f"/api/v1/agent/sessions/{test_session['id']}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == test_session["id"]
        assert data["title"] == "Test Session"

    @pytest.mark.asyncio
    async def test_delete_session(self, async_client, test_project):
        create_resp = await async_client.post(
            "/api/v1/agent/sessions",
            json={
                "project_id": test_project.id,
                "title": "To Delete",
                "model_name": "gemini-2.5-flash",
                "provider": "gemini",
            },
        )
        session_id = create_resp.json()["id"]
        del_resp = await async_client.delete(f"/api/v1/agent/sessions/{session_id}")
        assert del_resp.status_code == 200
        assert del_resp.json()["ok"] is True

        get_resp = await async_client.get(f"/api/v1/agent/sessions/{session_id}")
        assert get_resp.status_code == 404

    @pytest.mark.asyncio
    async def test_get_messages_empty(self, async_client, test_session):
        resp = await async_client.get(
            f"/api/v1/agent/sessions/{test_session['id']}/messages"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["messages"] == []
        assert data["total"] == 0

    @pytest.mark.asyncio
    async def test_session_not_found(self, async_client):
        resp = await async_client.get(f"/api/v1/agent/sessions/{uuid.uuid4()}")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_session_requires_valid_project(self, async_client):
        resp = await async_client.post(
            "/api/v1/agent/sessions",
            json={
                "project_id": str(uuid.uuid4()),
                "title": "No Project",
                "model_name": "gemini-2.5-flash",
                "provider": "gemini",
            },
        )
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# TestSSEProtocol
# ---------------------------------------------------------------------------


class TestSSEProtocol:
    @pytest.mark.asyncio
    async def test_thinking_event(self):
        from app.agent.sse_protocol import sse_thinking

        event = sse_thinking("analyzing")
        assert event["event"] == "thinking"
        parsed = json.loads(event["data"])
        assert parsed["status"] == "analyzing"

    @pytest.mark.asyncio
    async def test_thinking_with_request_id(self):
        from app.agent.sse_protocol import sse_thinking

        event = sse_thinking("analyzing", request_id="req-123")
        parsed = json.loads(event["data"])
        assert parsed["request_id"] == "req-123"
        assert parsed["status"] == "analyzing"

    @pytest.mark.asyncio
    async def test_tool_call_event(self):
        from app.agent.sse_protocol import sse_tool_call

        event = sse_tool_call("script_generate", {"text": "hi"}, "call-1")
        assert event["event"] == "tool_call"
        parsed = json.loads(event["data"])
        assert parsed["tool"] == "script_generate"
        assert parsed["args"] == {"text": "hi"}
        assert parsed["call_id"] == "call-1"

    @pytest.mark.asyncio
    async def test_tool_result_event(self):
        from app.agent.sse_protocol import sse_tool_result

        event = sse_tool_result("script_generate", "Done", "call-1", success=True)
        assert event["event"] == "tool_result"
        parsed = json.loads(event["data"])
        assert parsed["tool"] == "script_generate"
        assert parsed["success"] is True

    @pytest.mark.asyncio
    async def test_token_event(self):
        from app.agent.sse_protocol import sse_token

        event = sse_token("你好")
        assert event["event"] == "token"
        parsed = json.loads(event["data"])
        assert parsed["text"] == "你好"

    @pytest.mark.asyncio
    async def test_done_event(self):
        from app.agent.sse_protocol import sse_done

        event = sse_done("完成", {"input_tokens": 100, "output_tokens": 50})
        assert event["event"] == "done"
        parsed = json.loads(event["data"])
        assert parsed["output"] == "完成"
        assert parsed["usage"]["input_tokens"] == 100

    @pytest.mark.asyncio
    async def test_error_event(self):
        from app.agent.sse_protocol import sse_error

        event = sse_error("Something went wrong", "INTERNAL")
        assert event["event"] == "error"
        parsed = json.loads(event["data"])
        assert parsed["message"] == "Something went wrong"
        assert parsed["code"] == "INTERNAL"

    @pytest.mark.asyncio
    async def test_heartbeat_event(self):
        from app.agent.sse_protocol import sse_heartbeat

        event = sse_heartbeat()
        assert event["event"] == "heartbeat"

    @pytest.mark.asyncio
    async def test_all_event_types(self):
        from app.agent.sse_protocol import SSEEventType

        expected = {"thinking", "tool_call", "tool_result", "token", "done", "error", "heartbeat"}
        actual = {e.value for e in SSEEventType}
        assert actual == expected


# ---------------------------------------------------------------------------
# TestLangChainTools (replaces TestSkillToolset / TestPipelineTool / TestContextTools)
# ---------------------------------------------------------------------------


class TestLangChainTools:
    @pytest.mark.asyncio
    async def test_all_tools_available(self):
        from app.agent.tools import get_all_tools

        tools = get_all_tools()
        assert len(tools) > 0, "No tools registered"
        names = [t.name for t in tools]
        assert len(names) == len(set(names)), f"Duplicate tool names: {names}"

    @pytest.mark.asyncio
    async def test_context_gated_tools(self):
        from app.agent.tools import get_tools_for_context

        tools_no_ctx = get_tools_for_context(has_canvas=False, has_episode=False)
        tools_full = get_tools_for_context(has_canvas=True, has_episode=True)
        assert len(tools_full) >= len(tools_no_ctx), \
            "Full context should have >= tools than no context"


# ---------------------------------------------------------------------------
# TestAgentAuth
# ---------------------------------------------------------------------------


class TestAgentAuth:
    @pytest.mark.asyncio
    async def test_endpoints_require_auth(self):
        """Agent endpoints must require authentication."""
        from httpx import ASGITransport, AsyncClient

        from app.main import app

        app.dependency_overrides.clear()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get(
                "/api/v1/agent/sessions", params={"project_id": "x"}
            )
            assert resp.status_code == 401

            resp = await client.post(
                "/api/v1/agent/sessions",
                json={
                    "project_id": "x",
                    "model_name": "m",
                    "provider": "p",
                },
            )
            assert resp.status_code == 401
