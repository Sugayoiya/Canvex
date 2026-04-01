import json

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin_audit_log import AdminAuditLog


async def record_admin_audit(
    db: AsyncSession,
    *,
    admin_user_id: str,
    action_type: str,
    target_type: str,
    target_id: str,
    changes: dict,
    success: bool = True,
    error_message: str | None = None,
) -> AdminAuditLog:
    row = AdminAuditLog(
        admin_user_id=admin_user_id,
        action_type=action_type,
        target_type=target_type,
        target_id=target_id,
        changes=json.dumps(changes, ensure_ascii=False),
        success=success,
        error_message=error_message,
    )
    db.add(row)
    await db.flush()
    return row
