import json

import pytest
from sqlalchemy import select

from app.models.admin_audit_log import AdminAuditLog
from app.services.admin_audit import record_admin_audit


@pytest.mark.asyncio
async def test_record_admin_audit_persists_row(db_session):
    row = await record_admin_audit(
        db_session,
        admin_user_id="admin-1",
        action_type="user.disable",
        target_type="user",
        target_id="target-user-1",
        changes={"status": {"old": "active", "new": "disabled"}},
    )
    assert row.id is not None

    result = await db_session.execute(
        select(AdminAuditLog).where(AdminAuditLog.id == row.id)
    )
    persisted = result.scalar_one()
    assert persisted.action_type == "user.disable"
    assert persisted.target_type == "user"
    assert persisted.target_id == "target-user-1"
    assert persisted.success is True
    assert persisted.error_message is None


@pytest.mark.asyncio
async def test_record_admin_audit_persists_failure(db_session):
    row = await record_admin_audit(
        db_session,
        admin_user_id="admin-2",
        action_type="user.promote",
        target_type="user",
        target_id="target-user-2",
        changes={},
        success=False,
        error_message="blocked",
    )

    result = await db_session.execute(
        select(AdminAuditLog).where(AdminAuditLog.id == row.id)
    )
    persisted = result.scalar_one()
    assert persisted.success is False
    assert persisted.error_message == "blocked"


@pytest.mark.asyncio
async def test_changes_payload_contains_old_new(db_session):
    changes = {"status": {"old": "active", "new": "banned"}}
    row = await record_admin_audit(
        db_session,
        admin_user_id="admin-3",
        action_type="user.ban",
        target_type="user",
        target_id="target-user-3",
        changes=changes,
    )

    result = await db_session.execute(
        select(AdminAuditLog).where(AdminAuditLog.id == row.id)
    )
    persisted = result.scalar_one()
    parsed = json.loads(persisted.changes)
    assert "old" in parsed["status"]
    assert "new" in parsed["status"]
    assert parsed["status"]["old"] == "active"
    assert parsed["status"]["new"] == "banned"
