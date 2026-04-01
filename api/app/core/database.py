import logging

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import event, inspect, text

from app.core.config import settings

logger = logging.getLogger(__name__)

_sqlite_connect_args = {
    "check_same_thread": False,
    "timeout": 30,
}

engine = create_async_engine(
    settings.database_url,
    echo=False,
    future=True,
    connect_args=_sqlite_connect_args if settings.USE_SQLITE else {},
    pool_pre_ping=True,
)

if settings.USE_SQLITE:
    @event.listens_for(engine.sync_engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=30000")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


def _migrate_refresh_token_column(connection):
    """Migrate refresh_token → refresh_token_hash for existing databases."""
    insp = inspect(connection)
    if "users" not in insp.get_table_names():
        return

    columns = {col["name"] for col in insp.get_columns("users")}

    if "refresh_token_hash" in columns:
        return

    if "refresh_token" in columns:
        if settings.USE_SQLITE:
            connection.execute(
                text("ALTER TABLE users ADD COLUMN refresh_token_hash VARCHAR(64)")
            )
            connection.execute(text("UPDATE users SET refresh_token_hash = NULL"))
            logger.info("Migrated users.refresh_token → refresh_token_hash (SQLite: added new column)")
        else:
            connection.execute(
                text("ALTER TABLE users RENAME COLUMN refresh_token TO refresh_token_hash")
            )
            connection.execute(
                text("ALTER TABLE users ALTER COLUMN refresh_token_hash TYPE VARCHAR(64)")
            )
            logger.info("Migrated users.refresh_token → refresh_token_hash (PostgreSQL: renamed)")
    else:
        connection.execute(
            text("ALTER TABLE users ADD COLUMN refresh_token_hash VARCHAR(64)")
        )
        logger.info("Added users.refresh_token_hash column")


async def init_db():
    """Create all tables and seed defaults."""
    from app.models.user import User  # noqa
    from app.models.team import Team, TeamMember, TeamInvitation, Group, GroupMember, GroupProject  # noqa
    from app.models.project import Project  # noqa
    from app.models.skill_execution_log import SkillExecutionLog  # noqa
    from app.models.ai_call_log import AICallLog  # noqa
    from app.models.canvas import Canvas, CanvasNode, CanvasEdge  # noqa
    from app.models.model_pricing import ModelPricing  # noqa
    from app.models.agent_session import AgentSession, AgentMessage  # noqa
    from app.models.quota import UserQuota, TeamQuota, QuotaUsageLog  # noqa
    from app.models.oauth_account import OAuthAccount  # noqa
    from app.models.ai_provider_config import AIProviderConfig, AIProviderKey, AIModelConfig, AIModelProviderMapping  # noqa
    from app.models.admin_audit_log import AdminAuditLog  # noqa

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_migrate_refresh_token_column)

    await _seed_default_admin()
    await _seed_demo_project()

    from app.services.ai.provider_manager import seed_providers_from_env
    await seed_providers_from_env()


async def _seed_demo_project():
    """Create a demo project + canvas if none exist, so the chat UI is testable immediately."""
    import logging
    from sqlalchemy import func, select

    logger = logging.getLogger(__name__)

    async with AsyncSessionLocal() as session:
        from app.models.project import Project
        from app.models.canvas import Canvas
        from app.models.user import User

        count = (await session.execute(select(func.count()).select_from(Project))).scalar() or 0
        if count > 0:
            return

        admin = (await session.execute(select(User).limit(1))).scalar_one_or_none()
        if admin is None:
            return

        project = Project(
            name="Demo Project",
            description="Auto-created demo project for testing",
            owner_type="personal",
            owner_id=admin.id,
            created_by=admin.id,
        )
        session.add(project)
        await session.flush()

        canvas = Canvas(project_id=project.id, name="Demo Canvas")
        session.add(canvas)
        await session.flush()

        await session.commit()
        logger.info("Demo project (%s) and canvas (%s) created", project.id, canvas.id)


async def _seed_default_admin():
    import logging
    from sqlalchemy import func, select

    logger = logging.getLogger(__name__)

    async with AsyncSessionLocal() as session:
        from app.models.user import User

        result = await session.execute(select(func.count()).select_from(User))
        count = result.scalar() or 0
        if count == 0:
            from app.core.security import hash_password

            admin = User(
                email=settings.DEFAULT_ADMIN_EMAIL,
                password_hash=hash_password(settings.DEFAULT_ADMIN_PASSWORD),
                nickname="Admin",
                email_verified=True,
                status="active",
                is_admin=True,
            )
            session.add(admin)
            await session.commit()
            logger.info("Default admin created: %s", settings.DEFAULT_ADMIN_EMAIL)


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
