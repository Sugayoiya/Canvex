import asyncio
import os
import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

os.environ.setdefault("USE_SQLITE", "true")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-unit-tests")
os.environ.setdefault("DEFAULT_ADMIN_EMAIL", "admin@test.com")
os.environ.setdefault("DEFAULT_ADMIN_PASSWORD", "testpassword")

from app.core.database import Base  # noqa: E402
from app.main import app  # noqa: E402
from app.core.deps import get_db, get_current_user  # noqa: E402
from app.skills.register_all import register_all_skills  # noqa: E402

register_all_skills()

TEST_DB_URL = "sqlite+aiosqlite:///./test.db"


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def test_engine():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(test_engine):
    async_session = sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        yield session


class FakeUser:
    id = "test-user-id"
    email = "test@test.com"
    is_admin = True
    status = "active"


@pytest_asyncio.fixture
async def async_client(db_session):
    async def override_get_db():
        yield db_session

    async def override_get_user():
        return FakeUser()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Factory helpers for Phase 06+ tests
# ---------------------------------------------------------------------------

@pytest.fixture
def make_user(db_session):
    async def _make(email=None, nickname=None, is_admin=False):
        from app.models.user import User
        user = User(
            id=str(uuid.uuid4()),
            email=email or f"test-{uuid.uuid4().hex[:8]}@example.com",
            nickname=nickname or f"user-{uuid.uuid4().hex[:6]}",
            password_hash="$2b$12$fake",
            is_admin=is_admin,
            status="active",
        )
        db_session.add(user)
        await db_session.flush()
        return user
    return _make


@pytest.fixture
def make_team(db_session):
    async def _make(name=None):
        from app.models.team import Team
        team = Team(id=str(uuid.uuid4()), name=name or f"team-{uuid.uuid4().hex[:6]}")
        db_session.add(team)
        await db_session.flush()
        return team
    return _make


@pytest.fixture
def make_group(db_session):
    async def _make(team_id, name=None):
        from app.models.team import Group
        group = Group(id=str(uuid.uuid4()), team_id=team_id, name=name or f"group-{uuid.uuid4().hex[:6]}")
        db_session.add(group)
        await db_session.flush()
        return group
    return _make


@pytest.fixture
def make_project(db_session):
    async def _make(owner_type="personal", owner_id=None, name=None):
        from app.models.project import Project
        project = Project(
            id=str(uuid.uuid4()),
            name=name or f"project-{uuid.uuid4().hex[:6]}",
            owner_type=owner_type,
            owner_id=owner_id or str(uuid.uuid4()),
        )
        db_session.add(project)
        await db_session.flush()
        return project
    return _make
