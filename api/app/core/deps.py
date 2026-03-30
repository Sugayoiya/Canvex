import logging
from typing import AsyncGenerator

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.core.security import decode_access_token

logger = logging.getLogger(__name__)

# Legacy role priority — kept for backward compat with existing code paths
ROLE_PRIORITY = {"owner": 4, "admin": 3, "editor": 2}

TEAM_ROLE_PRIORITY = {"team_admin": 2, "member": 1}

GROUP_ROLE_PRIORITY = {"leader": 4, "editor": 3, "reviewer": 2, "viewer": 1}

_LEGACY_TEAM_ROLE_MAP = {"owner": "team_admin", "admin": "team_admin", "editor": "member"}

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=True)
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            try:
                await session.rollback()
            except Exception:
                pass
            raise


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    from app.models.user import User

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_access_token(token)
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception
    if user.status == "banned":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account has been banned",
        )
    return user


async def get_optional_user(
    token: str | None = Depends(oauth2_scheme_optional),
    db: AsyncSession = Depends(get_db),
):
    if token is None:
        return None
    from app.models.user import User

    try:
        payload = decode_access_token(token)
        user_id: str | None = payload.get("sub")
        if user_id is None:
            return None
    except JWTError:
        return None

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or user.status == "banned":
        return None
    return user


def require_admin(user):
    if not getattr(user, "is_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="System administrator privileges required",
        )


def _normalize_team_role(role: str) -> str:
    """Map legacy team roles to the new two-level scheme."""
    return _LEGACY_TEAM_ROLE_MAP.get(role, role)


async def require_team_member(
    team_id: str,
    user,
    db: AsyncSession,
    min_role: str = "member",
):
    from app.models.team import TeamMember

    result = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team_id,
            TeamMember.user_id == user.id,
        )
    )
    member = result.scalar_one_or_none()
    if member is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this team")

    effective_role = _normalize_team_role(member.role)
    required_role = _normalize_team_role(min_role)
    if TEAM_ROLE_PRIORITY.get(effective_role, 0) < TEAM_ROLE_PRIORITY.get(required_role, 0):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Requires at least '{min_role}' role")
    return member


async def require_group_member(
    group_id: str,
    user,
    db: AsyncSession,
    min_role: str = "editor",
):
    from app.models.team import GroupMember

    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user.id,
        )
    )
    member = result.scalar_one_or_none()
    if member is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this group")
    if GROUP_ROLE_PRIORITY.get(member.role, 0) < GROUP_ROLE_PRIORITY.get(min_role, 0):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Requires at least '{min_role}' group role")
    return member


async def _check_group_project_access(
    project_id: str,
    user_id: str,
    db: AsyncSession,
) -> str | None:
    """Return the best group role the user has for a project, or None."""
    from app.models.team import GroupProject, GroupMember

    result = await db.execute(
        select(GroupMember.role).join(
            GroupProject, GroupProject.group_id == GroupMember.group_id
        ).where(
            GroupProject.project_id == project_id,
            GroupMember.user_id == user_id,
        )
    )
    roles = [row[0] for row in result.all()]
    if not roles:
        return None
    return max(roles, key=lambda r: GROUP_ROLE_PRIORITY.get(r, 0))


async def resolve_project_access(
    project_id: str,
    user,
    db: AsyncSession,
    min_role: str = "editor",
):
    from app.models.project import Project

    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.is_deleted == False)  # noqa: E712
    )
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    if getattr(user, "is_admin", False):
        return project, "admin"

    if project.owner_type == "personal":
        if project.owner_id != user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        return project, "owner"
    elif project.owner_type == "team":
        member = await require_team_member(project.owner_id, user, db, min_role="member")
        team_role = _normalize_team_role(member.role)

        if team_role == "team_admin":
            return project, "team_admin"

        group_role = await _check_group_project_access(project_id, user.id, db)

        requires_write = min_role in ("editor", "leader", "admin", "owner", "team_admin")
        if requires_write:
            if group_role and GROUP_ROLE_PRIORITY.get(group_role, 0) >= GROUP_ROLE_PRIORITY.get("editor", 0):
                return project, group_role
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Requires group editor+ access for this project",
            )

        return project, group_role or "viewer"
    else:
        raise HTTPException(status_code=403, detail="Project has no owner")
