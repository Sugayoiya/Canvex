import uuid
from datetime import datetime, timezone

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_user
from app.main import app
from app.models.admin_audit_log import AdminAuditLog
from app.models.team import Team, TeamMember
from app.models.user import User


class AdminUser:
    def __init__(self, uid="admin-id-1"):
        self.id = uid
        self.email = "admin@test.com"
        self.is_admin = True
        self.status = "active"


class NonAdminUser:
    id = "regular-id-1"
    email = "regular@test.com"
    is_admin = False
    status = "active"


async def _seed_user(
    db: AsyncSession,
    *,
    email: str | None = None,
    nickname: str | None = None,
    is_admin: bool = False,
    status: str = "active",
    last_login_at: datetime | None = None,
    refresh_token_hash: str | None = None,
    refresh_token_expires: datetime | None = None,
) -> User:
    uid = str(uuid.uuid4())
    u = User(
        id=uid,
        email=email or f"{uuid.uuid4().hex[:8]}@example.com",
        nickname=nickname or f"user-{uuid.uuid4().hex[:6]}",
        password_hash="$2b$12$fake",
        is_admin=is_admin,
        status=status,
        last_login_at=last_login_at,
        refresh_token_hash=refresh_token_hash,
        refresh_token_expires=refresh_token_expires,
    )
    db.add(u)
    await db.flush()
    return u


@pytest_asyncio.fixture
async def admin_client(db_session):
    admin = await _seed_user(
        db_session, email="admin-main@test.com", is_admin=True, status="active"
    )

    async def override_get_db():
        yield db_session

    async def override_get_user():
        return AdminUser(uid=admin.id)

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client, admin, db_session

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def nonadmin_client(db_session):
    async def override_get_db():
        yield db_session

    async def override_get_user():
        return NonAdminUser()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()


# ── Test 1: authz ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_admin_users_requires_admin(nonadmin_client):
    resp = await nonadmin_client.get("/api/v1/admin/users")
    assert resp.status_code == 403


# ── Test 2: sensitive field exclusion ────────────────────────────────────

@pytest.mark.asyncio
async def test_admin_users_list_omits_sensitive_fields(admin_client):
    client, admin, db = admin_client

    await _seed_user(db, email="visible@test.com")

    resp = await client.get("/api/v1/admin/users")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    for item in data["items"]:
        assert "password_hash" not in item
        assert "refresh_token_hash" not in item
        assert "refresh_token_expires" not in item


# ── Test 3: ban clears refresh token ────────────────────────────────────

@pytest.mark.asyncio
async def test_patch_user_status_ban_clears_refresh(admin_client):
    client, admin, db = admin_client

    target = await _seed_user(
        db,
        email="banme@test.com",
        refresh_token_hash="some-hash-value",
        refresh_token_expires=datetime(2099, 1, 1, tzinfo=timezone.utc),
    )

    resp = await client.patch(
        f"/api/v1/admin/users/{target.id}/status",
        json={"status": "banned"},
    )
    assert resp.status_code == 200

    await db.refresh(target)
    assert target.status == "banned"
    assert target.refresh_token_hash is None
    assert target.refresh_token_expires is None

    result = await db.execute(
        select(AdminAuditLog).where(
            AdminAuditLog.target_id == target.id,
            AdminAuditLog.action_type == "user.status.update",
        )
    )
    audit = result.scalar_one()
    assert audit.success is True


# ── Test 4: self-demotion blocked ────────────────────────────────────────

@pytest.mark.asyncio
async def test_patch_admin_rejects_self_demotion(admin_client):
    client, admin, db = admin_client

    resp = await client.patch(
        f"/api/v1/admin/users/{admin.id}/admin",
        json={"is_admin": False},
    )
    assert resp.status_code == 400

    result = await db.execute(
        select(AdminAuditLog).where(
            AdminAuditLog.target_id == admin.id,
            AdminAuditLog.action_type == "user.admin.update",
            AdminAuditLog.success == False,  # noqa: E712
        )
    )
    audit = result.scalar_one()
    assert audit.error_message == "self_demotion_blocked"


# ── Test 5: last active admin blocked ────────────────────────────────────

@pytest.mark.asyncio
async def test_patch_admin_rejects_last_active_admin(admin_client):
    client, admin, db = admin_client

    # Create target who is the sole active admin in the DB
    sole_admin = await _seed_user(db, email="sole-admin@test.com", is_admin=True, status="active")

    # Make the calling admin non-admin in DB (auth override still passes require_admin)
    admin_row = (await db.execute(select(User).where(User.id == admin.id))).scalar_one()
    admin_row.is_admin = False
    await db.flush()

    # Now sole_admin is the only active admin in DB — demote should be blocked
    resp = await client.patch(
        f"/api/v1/admin/users/{sole_admin.id}/admin",
        json={"is_admin": False},
    )
    assert resp.status_code == 400

    result = await db.execute(
        select(AdminAuditLog).where(
            AdminAuditLog.target_id == sole_admin.id,
            AdminAuditLog.error_message == "last_admin_blocked",
        )
    )
    audit = result.scalar_one()
    assert audit.success is False

    # Restore admin for subsequent tests
    admin_row.is_admin = True
    await db.flush()


# ── Test 6: NULL sort handling ───────────────────────────────────────────

@pytest.mark.asyncio
async def test_admin_users_sort_last_login_null_handling(admin_client):
    client, admin, db = admin_client

    u_with_login = await _seed_user(
        db,
        email="haslogin@test.com",
        last_login_at=datetime(2025, 6, 1, tzinfo=timezone.utc),
    )
    u_no_login = await _seed_user(db, email="nologin@test.com", last_login_at=None)

    resp = await client.get(
        "/api/v1/admin/users",
        params={"sort_by": "last_login_at", "sort_order": "desc"},
    )
    assert resp.status_code == 200
    items = resp.json()["items"]

    logins = [item["last_login_at"] for item in items]
    non_null = [l for l in logins if l is not None]
    null_positions = [i for i, l in enumerate(logins) if l is None]

    if null_positions and non_null:
        assert all(pos >= len(non_null) for pos in null_positions), \
            "NULL last_login_at values should appear at end with nullslast"


# ── Test 7: teams field and admin_count in list response ─────────────

@pytest.mark.asyncio
async def test_admin_users_list_includes_teams_and_admin_count(admin_client):
    client, admin, db = admin_client

    user = await _seed_user(db, email="team-member@test.com", nickname="TeamUser")
    team = Team(id=str(uuid.uuid4()), name="TestTeam-Alpha")
    db.add(team)
    await db.flush()

    member = TeamMember(
        id=str(uuid.uuid4()),
        team_id=team.id,
        user_id=user.id,
        role="member",
    )
    db.add(member)
    await db.flush()

    resp = await client.get("/api/v1/admin/users")
    assert resp.status_code == 200
    data = resp.json()

    assert "admin_count" in data
    assert data["admin_count"] >= 1

    matched = [item for item in data["items"] if item["id"] == user.id]
    assert len(matched) == 1
    assert "teams" in matched[0]
    assert "TestTeam-Alpha" in matched[0]["teams"]
