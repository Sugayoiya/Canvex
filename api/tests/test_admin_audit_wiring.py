"""Integration tests verifying AdminAuditLog emission from quota, billing, and AI provider endpoints."""

import json

import pytest
from sqlalchemy import select

from app.models.admin_audit_log import AdminAuditLog


@pytest.mark.asyncio
async def test_quota_user_set_emits_audit(async_client, db_session):
    target_user_id = "quota-target-user-001"
    resp = await async_client.put(
        f"/api/v1/quota/user/{target_user_id}",
        json={"monthly_credit_limit": "500.0000", "daily_call_limit": 100},
    )
    assert resp.status_code == 200

    result = await db_session.execute(
        select(AdminAuditLog).where(
            AdminAuditLog.action_type == "quota.user.set",
            AdminAuditLog.target_id == target_user_id,
        )
    )
    row = result.scalar_one_or_none()
    assert row is not None
    assert row.success is True
    changes = json.loads(row.changes)
    assert "quota" in changes
    assert "old" in changes["quota"]
    assert "new" in changes["quota"]


@pytest.mark.asyncio
async def test_quota_team_set_emits_audit(async_client, db_session):
    target_team_id = "quota-target-team-001"
    resp = await async_client.put(
        f"/api/v1/quota/team/{target_team_id}",
        json={"monthly_credit_limit": "1000.0000"},
    )
    assert resp.status_code == 200

    result = await db_session.execute(
        select(AdminAuditLog).where(
            AdminAuditLog.action_type == "quota.team.set",
            AdminAuditLog.target_id == target_team_id,
        )
    )
    row = result.scalar_one_or_none()
    assert row is not None
    assert row.success is True


@pytest.mark.asyncio
async def test_billing_pricing_create_emits_audit(async_client, db_session):
    resp = await async_client.post(
        "/api/v1/billing/pricing/",
        json={
            "provider": "test-audit",
            "model": "audit-model-create",
            "model_type": "llm",
            "pricing_model": "per_token",
            "input_price_per_1k": "0.001",
        },
    )
    assert resp.status_code in (200, 201)
    pricing_id = resp.json()["id"]

    result = await db_session.execute(
        select(AdminAuditLog).where(
            AdminAuditLog.action_type == "pricing.create",
            AdminAuditLog.target_id == pricing_id,
        )
    )
    row = result.scalar_one_or_none()
    assert row is not None
    changes = json.loads(row.changes)
    assert changes["pricing"]["old"] is None
    assert changes["pricing"]["new"]["provider"] == "test-audit"


@pytest.mark.asyncio
async def test_billing_pricing_update_emits_audit(async_client, db_session):
    create_resp = await async_client.post(
        "/api/v1/billing/pricing/",
        json={
            "provider": "test-audit",
            "model": "audit-model-update",
            "model_type": "llm",
            "pricing_model": "per_token",
            "input_price_per_1k": "0.001",
        },
    )
    pricing_id = create_resp.json()["id"]

    resp = await async_client.patch(
        f"/api/v1/billing/pricing/{pricing_id}",
        json={"input_price_per_1k": "0.002"},
    )
    assert resp.status_code == 200

    result = await db_session.execute(
        select(AdminAuditLog).where(
            AdminAuditLog.action_type == "pricing.update",
            AdminAuditLog.target_id == pricing_id,
        )
    )
    row = result.scalar_one_or_none()
    assert row is not None
    changes = json.loads(row.changes)
    assert "old" in changes["pricing"]
    assert "new" in changes["pricing"]


@pytest.mark.asyncio
async def test_billing_pricing_deactivate_emits_audit(async_client, db_session):
    create_resp = await async_client.post(
        "/api/v1/billing/pricing/",
        json={
            "provider": "test-audit",
            "model": "audit-model-deactivate",
            "model_type": "llm",
            "pricing_model": "per_token",
        },
    )
    pricing_id = create_resp.json()["id"]

    resp = await async_client.delete(f"/api/v1/billing/pricing/{pricing_id}")
    assert resp.status_code == 200

    result = await db_session.execute(
        select(AdminAuditLog).where(
            AdminAuditLog.action_type == "pricing.deactivate",
            AdminAuditLog.target_id == pricing_id,
        )
    )
    row = result.scalar_one_or_none()
    assert row is not None
    changes = json.loads(row.changes)
    assert changes["is_active"]["old"] is True
    assert changes["is_active"]["new"] is False


@pytest.mark.asyncio
async def test_provider_system_create_emits_audit(async_client, db_session):
    resp = await async_client.post(
        "/api/v1/ai-providers/",
        json={
            "provider_name": "audit-test-provider",
            "display_name": "Audit Test Provider",
            "owner_type": "system",
        },
    )
    assert resp.status_code == 201
    provider_id = resp.json()["id"]

    result = await db_session.execute(
        select(AdminAuditLog).where(
            AdminAuditLog.action_type == "provider.create",
            AdminAuditLog.target_id == provider_id,
        )
    )
    row = result.scalar_one_or_none()
    assert row is not None
    changes = json.loads(row.changes)
    assert changes["provider"]["old"] is None
    assert changes["provider"]["new"]["provider_name"] == "audit-test-provider"


@pytest.mark.asyncio
async def test_provider_team_create_does_not_emit_audit(async_client, db_session):
    """Team-scope provider creation should NOT produce an AdminAuditLog entry."""
    from app.models.team import Team, TeamMember

    team = Team(id="audit-test-team-001", name="Audit Team")
    db_session.add(team)
    member = TeamMember(team_id=team.id, user_id="test-user-id", role="owner")
    db_session.add(member)
    await db_session.flush()

    resp = await async_client.post(
        "/api/v1/ai-providers/",
        json={
            "provider_name": "team-provider-no-audit",
            "display_name": "Team Provider No Audit",
            "owner_type": "team",
            "owner_id": team.id,
        },
    )
    assert resp.status_code == 201
    provider_id = resp.json()["id"]

    result = await db_session.execute(
        select(AdminAuditLog).where(
            AdminAuditLog.action_type == "provider.create",
            AdminAuditLog.target_id == provider_id,
        )
    )
    row = result.scalar_one_or_none()
    assert row is None


@pytest.mark.asyncio
async def test_provider_system_key_add_does_not_log_key_value(async_client, db_session):
    """API key values must never appear in the audit log changes JSON."""
    create_resp = await async_client.post(
        "/api/v1/ai-providers/",
        json={
            "provider_name": "key-audit-provider",
            "display_name": "Key Audit Provider",
            "owner_type": "system",
        },
    )
    provider_id = create_resp.json()["id"]

    secret_key = "sk-super-secret-12345"
    resp = await async_client.post(
        f"/api/v1/ai-providers/{provider_id}/keys",
        json={"api_key": secret_key, "label": "test-key"},
    )
    assert resp.status_code == 201
    key_id = resp.json()["id"]

    result = await db_session.execute(
        select(AdminAuditLog).where(
            AdminAuditLog.action_type == "provider.key.add",
            AdminAuditLog.target_id == key_id,
        )
    )
    row = result.scalar_one_or_none()
    assert row is not None

    raw_changes = row.changes
    assert secret_key not in raw_changes
    assert "api_key" not in raw_changes
    assert "api_key_encrypted" not in raw_changes

    changes = json.loads(raw_changes)
    assert changes["key"]["new"]["label"] == "test-key"
    assert changes["key"]["new"]["provider_config_id"] == provider_id
