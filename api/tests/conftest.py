import asyncio
import os

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
