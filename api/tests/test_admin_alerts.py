import pytest


@pytest.mark.asyncio
async def test_get_alerts_success(async_client):
    resp = await async_client.get("/api/v1/admin/alerts")
    assert resp.status_code == 200
    body = resp.json()
    assert "quota_warning_users" in body
    assert "failed_tasks_24h" in body
    assert "error_providers" in body


@pytest.mark.asyncio
async def test_get_alerts_values_are_non_negative(async_client):
    resp = await async_client.get("/api/v1/admin/alerts")
    assert resp.status_code == 200
    body = resp.json()
    assert body["quota_warning_users"] >= 0
    assert body["failed_tasks_24h"] >= 0
    assert body["error_providers"] >= 0


@pytest.mark.asyncio
async def test_get_alerts_non_admin_forbidden(async_client):
    from app.main import app
    from app.core.deps import get_current_user

    class NonAdminUser:
        id = "non-admin-id"
        email = "nonadmin@test.com"
        is_admin = False
        status = "active"

    app.dependency_overrides[get_current_user] = lambda: NonAdminUser()
    try:
        resp = await async_client.get("/api/v1/admin/alerts")
        assert resp.status_code == 403
    finally:
        from tests.conftest import FakeUser
        app.dependency_overrides[get_current_user] = lambda: FakeUser()
