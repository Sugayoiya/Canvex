import json
from decimal import Decimal
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin_audit_log import AdminAuditLog


def serialize_changes(data: dict) -> dict:
    """Recursively convert Decimal values to str for JSON-safe audit payloads."""
    out: dict[str, Any] = {}
    for k, v in data.items():
        if isinstance(v, Decimal):
            out[k] = str(v)
        elif isinstance(v, dict):
            out[k] = serialize_changes(v)
        else:
            out[k] = v
    return out


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


class AuditContext:
    """Bind db + admin user to eliminate repetitive parameter passing.

    Usage::

        audit = AuditContext(db, user.id)
        await audit.log("pricing.create", "model_pricing", pricing.id, changes={...})
        await audit.log_if(config.owner_type == "system",
            action_type="provider.create", target_type="ai_provider_config",
            target_id=config.id, changes={...})
    """

    __slots__ = ("_db", "_admin_user_id")

    def __init__(self, db: AsyncSession, admin_user_id: str) -> None:
        self._db = db
        self._admin_user_id = admin_user_id

    async def log(
        self,
        action_type: str,
        target_type: str,
        target_id: str,
        changes: dict,
        *,
        success: bool = True,
        error_message: str | None = None,
    ) -> AdminAuditLog:
        return await record_admin_audit(
            self._db,
            admin_user_id=self._admin_user_id,
            action_type=action_type,
            target_type=target_type,
            target_id=target_id,
            changes=changes,
            success=success,
            error_message=error_message,
        )

    async def log_if(
        self,
        condition: bool,
        /,
        **kwargs,
    ) -> AdminAuditLog | None:
        """Conditionally record an audit entry. Returns None when skipped."""
        if condition:
            return await self.log(**kwargs)
        return None
