import logging
from datetime import datetime
from decimal import Decimal

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.quota import UserQuota, TeamQuota, QuotaUsageLog
from app.schemas.quota import QuotaCheckResult

logger = logging.getLogger(__name__)


class QuotaService:
    """Fail-closed quota enforcement with atomic counter increments and idempotent usage tracking."""

    @staticmethod
    async def check_quota(user_id: str, team_id: str | None = None) -> QuotaCheckResult:
        """Pre-execution quota gate.  Returns allowed=False on ANY error (fail-closed)."""
        try:
            async with AsyncSessionLocal() as session:
                now = datetime.utcnow()

                stmt = select(UserQuota).where(UserQuota.user_id == user_id).with_for_update()
                uq = (await session.execute(stmt)).scalar_one_or_none()
                if uq:
                    QuotaService._lazy_reset(uq, now)
                    if uq.monthly_credit_limit is not None and uq.current_month_usage >= uq.monthly_credit_limit:
                        return QuotaCheckResult(
                            allowed=False,
                            reason="用户月度额度已用完",
                            error_code="USER_MONTHLY_QUOTA_EXCEEDED",
                            current_usage=uq.current_month_usage,
                            limit=uq.monthly_credit_limit,
                        )
                    if uq.daily_call_limit is not None and uq.current_day_calls >= uq.daily_call_limit:
                        return QuotaCheckResult(
                            allowed=False,
                            reason="用户每日调用次数已达上限",
                            error_code="USER_DAILY_QUOTA_EXCEEDED",
                        )

                if team_id:
                    stmt = select(TeamQuota).where(TeamQuota.team_id == team_id).with_for_update()
                    tq = (await session.execute(stmt)).scalar_one_or_none()
                    if tq:
                        QuotaService._lazy_reset(tq, now)
                        if tq.monthly_credit_limit is not None and tq.current_month_usage >= tq.monthly_credit_limit:
                            return QuotaCheckResult(
                                allowed=False,
                                reason="团队月度额度已用完",
                                error_code="TEAM_MONTHLY_QUOTA_EXCEEDED",
                                current_usage=tq.current_month_usage,
                                limit=tq.monthly_credit_limit,
                            )
                        if tq.daily_call_limit is not None and tq.current_day_calls >= tq.daily_call_limit:
                            return QuotaCheckResult(
                                allowed=False,
                                reason="团队每日调用次数已达上限",
                                error_code="TEAM_DAILY_QUOTA_EXCEEDED",
                            )

                await session.commit()
                return QuotaCheckResult(allowed=True)
        except Exception:
            logger.exception("Quota check failed — fail-closed")
            return QuotaCheckResult(
                allowed=False,
                reason="配额检查服务暂时不可用",
                error_code="QUOTA_SERVICE_ERROR",
            )

    @staticmethod
    async def update_usage(
        user_id: str,
        team_id: str | None,
        skill_execution_id: str,
        credit_amount: Decimal,
    ) -> bool:
        """Post-execution usage increment. Idempotent by skill_execution_id. Returns True if incremented."""
        try:
            async with AsyncSessionLocal() as session:
                existing = (
                    await session.execute(
                        select(QuotaUsageLog).where(QuotaUsageLog.skill_execution_id == skill_execution_id)
                    )
                ).scalar_one_or_none()
                if existing:
                    return False

                now = datetime.utcnow()

                stmt = select(UserQuota).where(UserQuota.user_id == user_id).with_for_update()
                uq = (await session.execute(stmt)).scalar_one_or_none()
                if uq:
                    QuotaService._lazy_reset(uq, now)
                    uq.current_month_usage += credit_amount
                    uq.current_day_calls += 1
                    uq.updated_at = now

                if team_id:
                    stmt = select(TeamQuota).where(TeamQuota.team_id == team_id).with_for_update()
                    tq = (await session.execute(stmt)).scalar_one_or_none()
                    if tq:
                        QuotaService._lazy_reset(tq, now)
                        tq.current_month_usage += credit_amount
                        tq.current_day_calls += 1
                        tq.updated_at = now

                session.add(QuotaUsageLog(
                    user_id=user_id,
                    team_id=team_id,
                    skill_execution_id=skill_execution_id,
                    credit_amount=credit_amount,
                    action="increment",
                ))

                await session.commit()
                return True
        except Exception:
            logger.exception("Quota update_usage failed for execution %s", skill_execution_id)
            return False

    @staticmethod
    def _lazy_reset(quota: UserQuota | TeamQuota, now: datetime) -> None:
        """Reset counters if month/day has rolled over since last reset."""
        if quota.last_month_reset.month != now.month or quota.last_month_reset.year != now.year:
            quota.current_month_usage = Decimal("0")
            quota.last_month_reset = now
        if quota.last_day_reset.date() != now.date():
            quota.current_day_calls = 0
            quota.last_day_reset = now
