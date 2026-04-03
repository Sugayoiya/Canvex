import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_db, get_current_user
from app.models.user import User
from app.models.team import TeamMember, Team
from app.schemas.user import UserSearchResult, UserProfileResponse, UserProfileUpdate
from app.schemas.models import DefaultModelSettings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/search", response_model=list[UserSearchResult])
async def search_users(
    q: str = Query(..., min_length=1),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pattern = f"%{q}%"
    stmt = (
        select(User)
        .where(
            or_(User.email.ilike(pattern), User.nickname.ilike(pattern)),
            User.id != user.id,
            User.status == "active",
        )
        .limit(20)
    )
    result = await db.execute(stmt)
    return [UserSearchResult.model_validate(u) for u in result.scalars().all()]


@router.get("/me", response_model=UserProfileResponse)
async def get_my_profile(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TeamMember)
        .where(TeamMember.user_id == user.id)
        .options(selectinload(TeamMember.team))
    )
    memberships = result.scalars().all()
    teams = [
        {
            "id": m.team.id,
            "name": m.team.name,
            "role": m.role,
            "avatar": m.team.avatar,
        }
        for m in memberships
        if m.team
    ]
    return UserProfileResponse(
        id=user.id,
        email=user.email,
        nickname=user.nickname,
        avatar=user.avatar,
        is_admin=user.is_admin,
        created_at=user.created_at,
        teams=teams,
    )


@router.patch("/me", response_model=UserProfileResponse)
async def update_my_profile(
    data: UserProfileUpdate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.nickname is not None:
        user.nickname = data.nickname
    if data.avatar is not None:
        user.avatar = data.avatar
    await db.flush()

    result = await db.execute(
        select(TeamMember)
        .where(TeamMember.user_id == user.id)
        .options(selectinload(TeamMember.team))
    )
    memberships = result.scalars().all()
    teams = [
        {
            "id": m.team.id,
            "name": m.team.name,
            "role": m.role,
            "avatar": m.team.avatar,
        }
        for m in memberships
        if m.team
    ]
    return UserProfileResponse(
        id=user.id,
        email=user.email,
        nickname=user.nickname,
        avatar=user.avatar,
        is_admin=user.is_admin,
        created_at=user.created_at,
        teams=teams,
    )


@router.get("/me/settings")
async def get_my_settings(user=Depends(get_current_user)):
    return {"settings": user.settings or {}}


@router.patch("/me/settings")
async def update_my_settings(
    data: DefaultModelSettings,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    current = user.settings or {}
    if data.default_llm_model is not None:
        current["default_llm_model"] = data.default_llm_model
    if data.default_image_model is not None:
        current["default_image_model"] = data.default_image_model
    user.settings = current
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(user, "settings")
    await db.flush()
    return {"settings": user.settings}
