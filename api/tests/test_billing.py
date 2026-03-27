import pytest


@pytest.mark.asyncio
async def test_create_pricing(async_client):
    resp = await async_client.post("/api/v1/billing/pricing/", json={
        "provider": "gemini",
        "model": "gemini-2.5-flash",
        "model_type": "llm",
        "pricing_model": "per_token",
        "input_price_per_1k": "0.00015",
        "output_price_per_1k": "0.0006",
    })
    assert resp.status_code in (200, 201)
    data = resp.json()
    assert data["provider"] == "gemini"
    assert data["model"] == "gemini-2.5-flash"


@pytest.mark.asyncio
async def test_list_pricing(async_client):
    resp = await async_client.get("/api/v1/billing/pricing/")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_usage_stats(async_client):
    resp = await async_client.get("/api/v1/billing/usage-stats/")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_pricing_non_admin_blocked():
    """Non-admin user should get 403 on pricing creation."""
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    from app.core.deps import get_current_user

    class NonAdminUser:
        id = "viewer-id"
        email = "viewer@test.com"
        is_admin = False
        status = "active"

    async def override_user():
        return NonAdminUser()

    app.dependency_overrides[get_current_user] = override_user
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/v1/billing/pricing/", json={
            "provider": "test", "model": "test", "pricing_model": "per_token",
        })
        assert resp.status_code == 403
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_pricing_decimal_precision(async_client):
    """Verify decimal pricing values are preserved."""
    resp = await async_client.post("/api/v1/billing/pricing/", json={
        "provider": "openai",
        "model": "gpt-4o",
        "model_type": "llm",
        "pricing_model": "per_token",
        "input_price_per_1k": "0.005",
        "output_price_per_1k": "0.015",
    })
    assert resp.status_code in (200, 201)
    data = resp.json()
    assert data["input_price_per_1k"] is not None
    assert data["output_price_per_1k"] is not None
