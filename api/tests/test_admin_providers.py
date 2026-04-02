import pytest
from unittest.mock import AsyncMock, patch

KHM_PATH = "app.services.ai.key_health.get_key_health_manager"
CC_PATH = "app.services.ai.credential_cache.get_credential_cache"


@pytest.mark.asyncio
async def test_admin_key_toggle(async_client):
    """CONV-10: Admin can toggle key enable/disable with immediate effect."""
    resp = await async_client.post("/api/v1/ai-providers/", json={
        "provider_name": "openai",
        "display_name": "OpenAI Toggle Test",
        "owner_type": "system",
    })
    assert resp.status_code == 201
    provider_id = resp.json()["id"]

    resp = await async_client.post(f"/api/v1/ai-providers/{provider_id}/keys", json={
        "api_key": "sk-test-toggle-key-12345678",
        "label": "toggle-test",
    })
    assert resp.status_code == 201
    key_id = resp.json()["id"]
    assert resp.json()["is_active"] is True

    mock_cache = AsyncMock()
    mock_khm = AsyncMock()
    with patch(KHM_PATH, return_value=mock_khm), \
         patch(CC_PATH, return_value=mock_cache):
        # Disable
        resp = await async_client.patch(
            f"/api/v1/ai-providers/{provider_id}/keys/{key_id}",
            json={"is_active": False},
        )
        assert resp.status_code == 200
        assert resp.json()["is_active"] is False
        mock_cache.invalidate.assert_awaited()

        # Enable
        resp = await async_client.patch(
            f"/api/v1/ai-providers/{provider_id}/keys/{key_id}",
            json={"is_active": True},
        )
        assert resp.status_code == 200
        assert resp.json()["is_active"] is True


@pytest.mark.asyncio
async def test_admin_key_reset_errors(async_client):
    """CONV-10: Admin can reset error count with immediate effect."""
    resp = await async_client.post("/api/v1/ai-providers/", json={
        "provider_name": "openai",
        "display_name": "OpenAI Reset Test",
        "owner_type": "system",
    })
    assert resp.status_code == 201
    provider_id = resp.json()["id"]

    resp = await async_client.post(f"/api/v1/ai-providers/{provider_id}/keys", json={
        "api_key": "sk-test-reset-key-12345678",
        "label": "reset-test",
    })
    assert resp.status_code == 201
    key_id = resp.json()["id"]

    mock_cache = AsyncMock()
    mock_khm = AsyncMock()
    with patch(KHM_PATH, return_value=mock_khm), \
         patch(CC_PATH, return_value=mock_cache):
        resp = await async_client.patch(
            f"/api/v1/ai-providers/{provider_id}/keys/{key_id}",
            json={"reset_error_count": True},
        )
        assert resp.status_code == 200
        mock_khm.reset_error_count.assert_awaited_once_with(key_id)
        mock_cache.invalidate.assert_awaited()


@pytest.mark.asyncio
async def test_batch_health_endpoint(async_client):
    """Batch health returns all keys' health in one call."""
    resp = await async_client.post("/api/v1/ai-providers/", json={
        "provider_name": "gemini",
        "display_name": "Gemini Health Test",
        "owner_type": "system",
    })
    assert resp.status_code == 201
    provider_id = resp.json()["id"]

    resp = await async_client.post(f"/api/v1/ai-providers/{provider_id}/keys", json={
        "api_key": "AIza-test-batch-health-key-1234",
        "label": "batch-health-key",
    })
    assert resp.status_code == 201
    key_id = resp.json()["id"]

    mock_khm = AsyncMock()
    mock_khm.get_health.return_value = {
        "error_count": 2,
        "last_used_at": "2026-04-02T10:00:00+00:00",
        "last_error_type": "RateLimitError",
        "is_healthy": True,
    }
    mock_khm.get_recent_errors.return_value = [
        {"type": "RateLimitError", "message": "Rate limit exceeded", "at": "2026-04-02T10:00:00+00:00"},
    ]
    mock_khm.get_usage_trend.return_value = [
        {"hour": "2026040210", "count": 5},
    ]

    with patch(KHM_PATH, return_value=mock_khm):
        resp = await async_client.get(f"/api/v1/ai-providers/{provider_id}/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["provider_id"] == provider_id
        assert len(data["keys"]) >= 1

        key_health = data["keys"][0]
        assert key_health["key_id"] == key_id
        assert key_health["error_count"] == 2
        assert key_health["health_badge"] == "degraded"
        assert key_health["is_healthy"] is True
        assert len(key_health["recent_errors"]) == 1
        assert len(key_health["usage_trend"]) == 1


@pytest.mark.asyncio
async def test_key_health_endpoint(async_client):
    """CONV-10: Per-key health endpoint returns correct schema."""
    resp = await async_client.post("/api/v1/ai-providers/", json={
        "provider_name": "deepseek",
        "display_name": "DeepSeek Health Test",
        "owner_type": "system",
    })
    assert resp.status_code == 201
    provider_id = resp.json()["id"]

    resp = await async_client.post(f"/api/v1/ai-providers/{provider_id}/keys", json={
        "api_key": "sk-test-key-health-endpoint-1234",
        "label": "health-test-key",
    })
    assert resp.status_code == 201
    key_id = resp.json()["id"]

    mock_khm = AsyncMock()
    mock_khm.get_health.return_value = {
        "error_count": 0,
        "last_used_at": None,
        "last_error_type": None,
        "is_healthy": True,
    }
    mock_khm.get_recent_errors.return_value = []
    mock_khm.get_usage_trend.return_value = []

    with patch(KHM_PATH, return_value=mock_khm):
        resp = await async_client.get(
            f"/api/v1/ai-providers/{provider_id}/keys/{key_id}/health"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["key_id"] == key_id
        assert data["error_count"] == 0
        assert data["health_badge"] == "healthy"
        assert data["is_healthy"] is True
        assert data["recent_errors"] == []
        assert data["usage_trend"] == []


@pytest.mark.asyncio
async def test_cache_invalidation_on_toggle(async_client):
    """PATCH key triggers credential cache invalidation for immediate effect (D-05)."""
    resp = await async_client.post("/api/v1/ai-providers/", json={
        "provider_name": "openai",
        "display_name": "OpenAI Cache Test",
        "owner_type": "system",
    })
    assert resp.status_code == 201
    provider_id = resp.json()["id"]

    resp = await async_client.post(f"/api/v1/ai-providers/{provider_id}/keys", json={
        "api_key": "sk-test-cache-invalidation-key",
        "label": "cache-test",
    })
    assert resp.status_code == 201
    key_id = resp.json()["id"]

    mock_cache = AsyncMock()
    mock_khm = AsyncMock()
    with patch(KHM_PATH, return_value=mock_khm), \
         patch(CC_PATH, return_value=mock_cache):
        await async_client.patch(
            f"/api/v1/ai-providers/{provider_id}/keys/{key_id}",
            json={"is_active": False},
        )
        mock_cache.invalidate.assert_awaited_once_with("openai", "system", None)
