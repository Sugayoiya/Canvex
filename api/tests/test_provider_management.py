"""Unit tests for ProviderManager infrastructure: DB chain, rotation, retry, cache, no-env-fallback."""

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, patch

from app.services.ai.provider_manager import (
    ProviderManager, get_provider_manager, _current_key_id_var,
)


@pytest.fixture(autouse=True)
def _reset_provider_manager(monkeypatch):
    """Reset singleton + registry for test isolation."""
    import app.services.ai.provider_manager as pm_mod
    monkeypatch.setattr(pm_mod, "_manager", None)
    pm_mod._PROVIDER_REGISTRY.clear()


def _register_fake_provider(monkeypatch):
    """Register a dummy provider class in the registry."""
    import app.services.ai.provider_manager as pm_mod

    class FakeProvider:
        def __init__(self, api_key, model):
            self.api_key = api_key
            self.model = model

    pm_mod._PROVIDER_REGISTRY["gemini"] = (FakeProvider, "gemini-2.5-flash")
    return FakeProvider


@pytest.mark.asyncio
async def test_get_provider_async_db_chain(
    db_session, mock_key_health, mock_credential_cache, make_provider_config, monkeypatch,
):
    """CONV-05: get_provider() resolves via async DB chain and returns 3-tuple."""
    FakeProvider = _register_fake_provider(monkeypatch)
    config, keys = await make_provider_config(provider_name="gemini")

    pm = get_provider_manager()
    provider_inst, owner_desc, key_id = await pm.get_provider("gemini", db=db_session)

    assert isinstance(provider_inst, FakeProvider)
    assert provider_inst.api_key  # decrypted key is present
    assert key_id == keys[0].id
    assert owner_desc == "system"


@pytest.mark.asyncio
async def test_credential_chain_team_before_system(
    db_session, mock_key_health, mock_credential_cache, make_provider_config, monkeypatch,
):
    """CONV-05: Team credentials take priority over system credentials."""
    _register_fake_provider(monkeypatch)

    await make_provider_config(provider_name="gemini", owner_type="system")
    team_config, team_keys = await make_provider_config(
        provider_name="gemini", owner_type="team", owner_id="t1",
        keys=[{"api_key": "team-key-abc", "label": "team-key"}],
    )

    pm = get_provider_manager()
    _inst, owner_desc, key_id = await pm.get_provider("gemini", team_id="t1", db=db_session)

    assert "team" in owner_desc
    assert key_id == team_keys[0].id


@pytest.mark.asyncio
async def test_key_rotation_round_robin(
    db_session, mock_key_health, mock_credential_cache, make_provider_config, monkeypatch,
):
    """CONV-07: Round-robin distributes across multiple active keys via KeyRotator."""
    _register_fake_provider(monkeypatch)

    config, keys = await make_provider_config(
        provider_name="gemini",
        keys=[
            {"api_key": "key-alpha", "label": "alpha"},
            {"api_key": "key-beta", "label": "beta"},
        ],
    )

    from app.services.ai.provider_manager import KeyRotator
    rotator = KeyRotator()
    seen_key_ids = set()
    for _ in range(4):
        key_obj = await rotator.next_key("gemini", keys)
        seen_key_ids.add(key_obj.id)

    assert len(seen_key_ids) == 2, f"Expected 2 distinct keys, got {seen_key_ids}"


@pytest.mark.asyncio
async def test_error_feedback_loop(mock_key_health):
    """CONV-08: Reporting errors increments count and eventually marks key unhealthy."""
    key_id = "test-key-feedback"

    for _ in range(5):
        await mock_key_health.report_error(key_id, "RateLimitError", "429 rate limited")

    health = await mock_key_health.get_health(key_id)
    assert health["error_count"] == 5
    assert health["is_healthy"] is False


@pytest.mark.asyncio
async def test_auto_retry_next_key(
    db_session, mock_key_health, mock_credential_cache, make_provider_config, monkeypatch,
):
    """CONV-09: Unhealthy keys are skipped, healthy keys are selected."""
    _register_fake_provider(monkeypatch)

    config, keys = await make_provider_config(
        provider_name="gemini",
        keys=[
            {"api_key": "key-sick", "label": "sick"},
            {"api_key": "key-healthy", "label": "healthy"},
        ],
    )

    # Make key-1 unhealthy via 5 error reports
    sick_key_id = keys[0].id
    for _ in range(5):
        await mock_key_health.report_error(sick_key_id, "RateLimitError", "429")

    pm = get_provider_manager()
    _inst, _desc, key_id = await pm.get_provider("gemini", db=db_session)

    assert key_id == keys[1].id, "Should skip unhealthy key and select healthy one"


@pytest.mark.asyncio
async def test_credential_cache_hit(
    db_session, mock_key_health, mock_credential_cache, make_provider_config, monkeypatch,
):
    """CONV-05: Credential cache hit avoids full chain walk."""
    _register_fake_provider(monkeypatch)

    config, keys = await make_provider_config(provider_name="gemini")

    # Pre-populate cache
    await mock_credential_cache.set_cached("gemini", "system", None, {
        "key_id": keys[0].id,
        "config_id": config.id,
        "provider_name": "gemini",
        "owner_type": "system",
        "owner_desc": "system",
    })

    pm = get_provider_manager()
    _inst, owner_desc, key_id = await pm.get_provider("gemini", db=db_session)

    assert key_id == keys[0].id
    assert "system" in owner_desc or owner_desc == "cached"


@pytest.mark.asyncio
async def test_credential_cache_invalidation(mock_credential_cache):
    """CONV-05: Cache invalidation clears cached credentials."""
    await mock_credential_cache.set_cached("gemini", "system", None, {
        "key_id": "k1", "config_id": "c1", "provider_name": "gemini",
        "owner_type": "system", "owner_desc": "system",
    })

    await mock_credential_cache.invalidate("gemini", "system")

    result = await mock_credential_cache.get_cached("gemini", [("system", None)])
    assert result is None


@pytest.mark.asyncio
async def test_no_env_fallback(
    db_session, mock_key_health, mock_credential_cache, monkeypatch,
):
    """CONV-05: No env-var fallback — raises ValueError when no DB keys exist."""
    _register_fake_provider(monkeypatch)

    pm = get_provider_manager()
    with pytest.raises(ValueError, match="No API key configured"):
        await pm.get_provider("gemini", db=db_session)


@pytest.mark.asyncio
async def test_error_redaction():
    """Security: Error messages are redacted before Redis storage."""
    from app.services.ai.key_health import _redact_error_message

    msg = "Error with key sk-abcdefghijklmnopqrstuv and token Bearer eyJhbGciOiJIUzI1NiJ9.test"
    redacted = _redact_error_message(msg)

    assert "sk-abcdefghijklmnopqrstuv" not in redacted
    assert "eyJhbGciOiJIUzI1NiJ9" not in redacted
    assert "[REDACTED]" in redacted


@pytest.mark.asyncio
async def test_degraded_mode_redis_down():
    """Resilience: KeyHealthManager degrades gracefully when Redis is down."""
    from app.services.ai.key_health import KeyHealthManager
    from redis.exceptions import ConnectionError as RedisConnectionError
    from unittest.mock import MagicMock

    khm = KeyHealthManager()
    mock_redis = MagicMock()
    mock_redis.hgetall = AsyncMock(side_effect=RedisConnectionError("Connection refused"))
    mock_pipe = MagicMock()
    mock_pipe.hincrby = MagicMock(return_value=mock_pipe)
    mock_pipe.hset = MagicMock(return_value=mock_pipe)
    mock_pipe.lpush = MagicMock(return_value=mock_pipe)
    mock_pipe.ltrim = MagicMock(return_value=mock_pipe)
    mock_pipe.execute = AsyncMock(side_effect=RedisConnectionError("Connection refused"))
    mock_redis.pipeline = MagicMock(return_value=mock_pipe)
    khm._redis = mock_redis

    health = await khm.get_health("any-key")
    assert health["is_healthy"] is True
    assert health["error_count"] == 0

    # report_error should not raise
    await khm.report_error("any-key", "SomeError", "some message")
