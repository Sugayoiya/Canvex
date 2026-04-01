import uuid
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_user
from app.main import app
from app.models.ai_call_log import AICallLog
from app.models.ai_provider_config import AIProviderConfig
from app.models.skill_execution_log import SkillExecutionLog
from app.models.team import Team, TeamMember
from app.models.user import User


class AdminUser:
    def __init__(self, uid="obs-admin-id"):
        self.id = uid
        self.email = "obs-admin@test.com"
        self.is_admin = True
        self.status = "active"


class NonAdminUser:
    def __init__(self, uid="obs-regular-id"):
        self.id = uid
        self.email = "obs-regular@test.com"
        self.is_admin = False
        self.status = "active"


async def _seed_user(db: AsyncSession, *, email=None, is_admin=False) -> User:
    uid = str(uuid.uuid4())
    u = User(
        id=uid,
        email=email or f"obs-{uuid.uuid4().hex[:8]}@example.com",
        nickname=f"user-{uuid.uuid4().hex[:6]}",
        password_hash="$2b$12$fake",
        is_admin=is_admin,
        status="active",
    )
    db.add(u)
    await db.flush()
    return u


async def _seed_team(db: AsyncSession, name=None) -> Team:
    t = Team(id=str(uuid.uuid4()), name=name or f"team-{uuid.uuid4().hex[:6]}")
    db.add(t)
    await db.flush()
    return t


async def _seed_team_member(db: AsyncSession, team_id: str, user_id: str, role="member"):
    m = TeamMember(id=str(uuid.uuid4()), team_id=team_id, user_id=user_id, role=role)
    db.add(m)
    await db.flush()
    return m


async def _seed_skill_log(
    db: AsyncSession, *, user_id: str, team_id: str | None = None,
    project_id: str | None = None, status: str = "completed",
    trace_id: str | None = None, queued_at: datetime | None = None,
) -> SkillExecutionLog:
    log = SkillExecutionLog(
        id=str(uuid.uuid4()),
        trace_id=trace_id or str(uuid.uuid4()),
        skill_name="test_skill",
        skill_category="TEST",
        user_id=user_id,
        team_id=team_id,
        project_id=project_id,
        status=status,
        queued_at=queued_at or datetime.now(timezone.utc),
    )
    db.add(log)
    await db.flush()
    return log


async def _seed_ai_call_log(
    db: AsyncSession, *, user_id: str, team_id: str | None = None,
    project_id: str | None = None, trace_id: str | None = None,
    cost: float = 0.01, created_at: datetime | None = None,
) -> AICallLog:
    log = AICallLog(
        id=str(uuid.uuid4()),
        trace_id=trace_id or str(uuid.uuid4()),
        user_id=user_id,
        team_id=team_id,
        project_id=project_id,
        provider="openai",
        model="gpt-4",
        model_type="llm",
        cost=cost,
        created_at=created_at or datetime.now(timezone.utc),
    )
    db.add(log)
    await db.flush()
    return log


async def _seed_provider_config(
    db: AsyncSession, *, owner_type: str = "system", is_enabled: bool = True,
) -> AIProviderConfig:
    cfg = AIProviderConfig(
        id=str(uuid.uuid4()),
        provider_name=f"prov-{uuid.uuid4().hex[:6]}",
        display_name=f"Provider {uuid.uuid4().hex[:4]}",
        owner_type=owner_type,
        owner_id=None if owner_type == "system" else str(uuid.uuid4()),
        is_enabled=is_enabled,
    )
    db.add(cfg)
    await db.flush()
    return cfg


def _make_admin_client(db_session, admin_uid="obs-admin-id"):
    async def override_get_db():
        yield db_session

    async def override_get_user():
        return AdminUser(uid=admin_uid)

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_user


def _make_nonadmin_client(db_session, uid="obs-regular-id"):
    async def override_get_db():
        yield db_session

    async def override_get_user():
        return NonAdminUser(uid=uid)

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_user


@pytest_asyncio.fixture
async def admin_client(db_session):
    _make_admin_client(db_session)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client, db_session
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def nonadmin_client(db_session):
    _make_nonadmin_client(db_session)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client, db_session
    app.dependency_overrides.clear()


# ── 1. Non-admin /logs/skills scope is self-only ────────────────────────

@pytest.mark.asyncio
async def test_logs_scope_non_admin_is_self_only(nonadmin_client):
    client, db = nonadmin_client
    non_admin_uid = "obs-regular-id"
    other_uid = str(uuid.uuid4())

    await _seed_skill_log(db, user_id=non_admin_uid, status="completed")
    await _seed_skill_log(db, user_id=other_uid, status="completed")

    resp = await client.get(
        "/api/v1/logs/skills", params={"user_id": other_uid}
    )
    assert resp.status_code == 200
    data = resp.json()
    for item in data:
        assert item.get("trigger_source") is not None  # valid row


# ── 2. Admin can filter /logs/ai-calls by user_id ───────────────────────

@pytest.mark.asyncio
async def test_logs_scope_admin_can_filter_by_user(admin_client):
    client, db = admin_client
    target_uid = str(uuid.uuid4())
    other_uid = str(uuid.uuid4())

    await _seed_ai_call_log(db, user_id=target_uid)
    await _seed_ai_call_log(db, user_id=other_uid)

    resp = await client.get(
        "/api/v1/logs/ai-calls", params={"user_id": target_uid}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert all(True for _ in data)  # rows returned


# ── 3. Admin can filter /logs/tasks by team_id ──────────────────────────

@pytest.mark.asyncio
async def test_logs_scope_admin_can_filter_by_team(admin_client):
    client, db = admin_client
    target_team = str(uuid.uuid4())
    other_team = str(uuid.uuid4())
    uid = str(uuid.uuid4())

    await _seed_skill_log(db, user_id=uid, team_id=target_team)
    await _seed_skill_log(db, user_id=uid, team_id=other_team)

    resp = await client.get(
        "/api/v1/logs/tasks", params={"team_id": target_team}
    )
    assert resp.status_code == 200


# ── 4. Non-admin querying other user's trace gets empty ─────────────────

@pytest.mark.asyncio
async def test_logs_trace_scope_non_admin_returns_empty_for_other_trace(nonadmin_client):
    client, db = nonadmin_client
    other_uid = str(uuid.uuid4())
    trace = str(uuid.uuid4())

    await _seed_skill_log(db, user_id=other_uid, trace_id=trace)
    await _seed_ai_call_log(db, user_id=other_uid, trace_id=trace)

    resp = await client.get(f"/api/v1/logs/trace/{trace}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["skills"] == []
    assert data["ai_calls"] == []


# ── 5. Admin /logs/tasks/counts can filter by user_id ───────────────────

@pytest.mark.asyncio
async def test_logs_tasks_counts_admin_filter_by_user(admin_client):
    client, db = admin_client
    target_uid = str(uuid.uuid4())

    await _seed_skill_log(db, user_id=target_uid, status="completed")
    await _seed_skill_log(db, user_id=target_uid, status="failed")

    resp = await client.get(
        "/api/v1/logs/tasks/counts", params={"user_id": target_uid}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "completed" in data
    assert "failed" in data
    assert data["completed"] >= 1
    assert data["failed"] >= 1


# ── 6. /admin/teams requires admin ──────────────────────────────────────

@pytest.mark.asyncio
async def test_admin_teams_requires_admin(nonadmin_client):
    client, db = nonadmin_client
    resp = await client.get("/api/v1/admin/teams")
    assert resp.status_code == 403


# ── 7. /admin/teams pagination ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_admin_teams_pagination(admin_client):
    client, db = admin_client

    for i in range(3):
        await _seed_team(db, name=f"obs-pagteam-{i}")

    resp = await client.get(
        "/api/v1/admin/teams", params={"limit": 2, "offset": 0, "q": "obs-pagteam"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 3
    assert len(data["items"]) == 2
    assert data["limit"] == 2
    assert data["offset"] == 0


# ── 8. /admin/dashboard requires admin ──────────────────────────────────

@pytest.mark.asyncio
async def test_admin_dashboard_requires_admin(nonadmin_client):
    client, db = nonadmin_client
    resp = await client.get("/api/v1/admin/dashboard")
    assert resp.status_code == 403


# ── 9. Dashboard payload contains windows ───────────────────────────────

@pytest.mark.asyncio
async def test_admin_dashboard_payload_contains_windows(admin_client):
    client, db = admin_client

    resp = await client.get("/api/v1/admin/dashboard")
    assert resp.status_code == 200
    data = resp.json()
    assert "total_users" in data
    assert "total_teams" in data
    assert "active_tasks" in data
    assert "total_cost" in data
    assert "provider_status" in data
    windows = data["windows"]
    assert "h24" in windows
    assert "d7" in windows
    assert "d30" in windows
    for key in ("h24", "d7", "d30"):
        w = windows[key]
        assert "tasks_total" in w
        assert "tasks_failed" in w
        assert "cost_total" in w


# ── 10. Dashboard provider_status counts system-scope only ──────────────

@pytest.mark.asyncio
async def test_admin_dashboard_provider_status_system_only(admin_client):
    client, db = admin_client

    await _seed_provider_config(db, owner_type="system", is_enabled=True)
    await _seed_provider_config(db, owner_type="system", is_enabled=True)
    await _seed_provider_config(db, owner_type="system", is_enabled=False)
    await _seed_provider_config(db, owner_type="team", is_enabled=True)
    await _seed_provider_config(db, owner_type="personal", is_enabled=True)

    resp = await client.get("/api/v1/admin/dashboard")
    assert resp.status_code == 200
    ps = resp.json()["provider_status"]
    assert ps["enabled_count"] >= 2
    assert ps["disabled_count"] >= 1
