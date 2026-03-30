import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.deps import get_db, get_current_user, require_team_member
from app.models.team import Team, TeamMember, TeamInvitation
from app.models.user import User
from app.schemas.team import (
    TeamCreate,
    TeamUpdate,
    TeamResponse,
    TeamMemberResponse,
    AddMemberRequest,
    UpdateMemberRequest,
    InvitationResponse,
    CreateInvitationRequest,
)

router = APIRouter(prefix="/teams", tags=["teams"])

VALID_TEAM_ROLES = {"team_admin", "member"}


# ---------------------------------------------------------------------------
# Team CRUD
# ---------------------------------------------------------------------------

@router.post("/", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
async def create_team(
    req: TeamCreate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    team = Team(name=req.name, description=req.description)
    db.add(team)
    await db.flush()

    membership = TeamMember(team_id=team.id, user_id=user.id, role="team_admin")
    db.add(membership)
    await db.flush()

    return TeamResponse(
        id=team.id,
        name=team.name,
        description=team.description,
        avatar=team.avatar,
        created_at=team.created_at,
        member_count=1,
        my_role="team_admin",
    )


@router.get("/", response_model=list[TeamResponse])
async def list_teams(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TeamMember).where(TeamMember.user_id == user.id).options(selectinload(TeamMember.team))
    )
    memberships = result.scalars().all()

    teams = []
    for m in memberships:
        team = m.team
        if getattr(team, "is_deleted", False):
            continue
        count_result = await db.execute(
            select(func.count()).select_from(TeamMember).where(TeamMember.team_id == team.id)
        )
        member_count = count_result.scalar() or 0
        teams.append(TeamResponse(
            id=team.id,
            name=team.name,
            description=team.description,
            avatar=team.avatar,
            created_at=team.created_at,
            member_count=member_count,
            my_role=m.role,
        ))
    return teams


@router.get("/{team_id}", response_model=TeamResponse)
async def get_team(
    team_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    member = await require_team_member(team_id, user, db, min_role="member")

    result = await db.execute(select(Team).where(Team.id == team_id, Team.is_deleted == False))  # noqa: E712
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    count_result = await db.execute(
        select(func.count()).select_from(TeamMember).where(TeamMember.team_id == team_id)
    )
    member_count = count_result.scalar() or 0

    return TeamResponse(
        id=team.id,
        name=team.name,
        description=team.description,
        avatar=team.avatar,
        created_at=team.created_at,
        member_count=member_count,
        my_role=member.role,
    )


@router.patch("/{team_id}", response_model=TeamResponse)
async def update_team(
    team_id: str,
    req: TeamUpdate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    member = await require_team_member(team_id, user, db, min_role="team_admin")

    result = await db.execute(select(Team).where(Team.id == team_id, Team.is_deleted == False))  # noqa: E712
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    update_data = req.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(team, k, v)

    count_result = await db.execute(
        select(func.count()).select_from(TeamMember).where(TeamMember.team_id == team_id)
    )
    return TeamResponse(
        id=team.id,
        name=team.name,
        description=team.description,
        avatar=team.avatar,
        created_at=team.created_at,
        member_count=count_result.scalar() or 0,
        my_role=member.role,
    )


@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_team(
    team_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_team_member(team_id, user, db, min_role="team_admin")

    result = await db.execute(select(Team).where(Team.id == team_id, Team.is_deleted == False))  # noqa: E712
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    team.is_deleted = True
    team.deleted_at = datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Member management
# ---------------------------------------------------------------------------

@router.get("/{team_id}/members", response_model=list[TeamMemberResponse])
async def list_members(
    team_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_team_member(team_id, user, db, min_role="member")

    result = await db.execute(
        select(TeamMember).where(TeamMember.team_id == team_id).options(selectinload(TeamMember.user))
    )
    members = result.scalars().all()

    return [
        TeamMemberResponse(
            id=m.id,
            user_id=m.user_id,
            role=m.role,
            joined_at=m.joined_at,
            user_email=m.user.email if m.user else None,
            user_nickname=m.user.nickname if m.user else None,
            user_avatar=m.user.avatar if m.user else None,
        )
        for m in members
    ]


@router.post("/{team_id}/members", response_model=TeamMemberResponse, status_code=status.HTTP_201_CREATED)
async def add_member(
    team_id: str,
    req: AddMemberRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_team_member(team_id, user, db, min_role="team_admin")

    target_result = await db.execute(select(User).where(User.id == req.user_id))
    target_user = target_result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    existing = await db.execute(
        select(TeamMember).where(TeamMember.team_id == team_id, TeamMember.user_id == req.user_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="User is already a team member")

    if req.role not in VALID_TEAM_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {VALID_TEAM_ROLES}")

    membership = TeamMember(team_id=team_id, user_id=req.user_id, role=req.role)
    db.add(membership)
    await db.flush()

    return TeamMemberResponse(
        id=membership.id,
        user_id=membership.user_id,
        role=membership.role,
        joined_at=membership.joined_at,
        user_email=target_user.email,
        user_nickname=target_user.nickname,
        user_avatar=target_user.avatar,
    )


@router.patch("/{team_id}/members/{member_id}", response_model=TeamMemberResponse)
async def update_member(
    team_id: str,
    member_id: str,
    req: UpdateMemberRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_team_member(team_id, user, db, min_role="team_admin")

    if req.role not in VALID_TEAM_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {VALID_TEAM_ROLES}")

    result = await db.execute(
        select(TeamMember).where(TeamMember.id == member_id, TeamMember.team_id == team_id)
        .options(selectinload(TeamMember.user))
    )
    member_obj = result.scalar_one_or_none()
    if not member_obj:
        raise HTTPException(status_code=404, detail="Member not found")

    member_obj.role = req.role
    return TeamMemberResponse(
        id=member_obj.id,
        user_id=member_obj.user_id,
        role=member_obj.role,
        joined_at=member_obj.joined_at,
        user_email=member_obj.user.email if member_obj.user else None,
        user_nickname=member_obj.user.nickname if member_obj.user else None,
        user_avatar=member_obj.user.avatar if member_obj.user else None,
    )


@router.delete("/{team_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    team_id: str,
    member_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_team_member(team_id, user, db, min_role="team_admin")

    result = await db.execute(
        select(TeamMember).where(TeamMember.id == member_id, TeamMember.team_id == team_id)
    )
    member_obj = result.scalar_one_or_none()
    if not member_obj:
        raise HTTPException(status_code=404, detail="Member not found")

    if member_obj.role == "team_admin":
        admin_count = await db.execute(
            select(func.count()).select_from(TeamMember).where(
                TeamMember.team_id == team_id, TeamMember.role == "team_admin"
            )
        )
        if (admin_count.scalar() or 0) <= 1:
            raise HTTPException(status_code=400, detail="Cannot remove the last team admin")

    await db.delete(member_obj)


# ---------------------------------------------------------------------------
# Invitations
# ---------------------------------------------------------------------------

@router.post("/{team_id}/invitations", response_model=InvitationResponse, status_code=status.HTTP_201_CREATED)
async def create_invitation(
    team_id: str,
    req: CreateInvitationRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_team_member(team_id, user, db, min_role="team_admin")

    token = secrets.token_urlsafe(32)
    invitation = TeamInvitation(
        team_id=team_id,
        role=req.role,
        token=token,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    db.add(invitation)
    await db.flush()

    return InvitationResponse(
        id=invitation.id,
        token=invitation.token,
        role=invitation.role,
        expires_at=invitation.expires_at,
        is_used=invitation.is_used,
        invite_url=f"{settings.FRONTEND_URL}/invite/{token}",
    )


@router.post("/invitations/{token}/accept", response_model=TeamMemberResponse)
async def accept_invitation(
    token: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TeamInvitation).where(TeamInvitation.token == token)
    )
    invitation = result.scalar_one_or_none()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")
    if invitation.is_used:
        raise HTTPException(status_code=400, detail="Invitation already used")
    if invitation.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invitation expired")

    existing = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == invitation.team_id, TeamMember.user_id == user.id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Already a member of this team")

    membership = TeamMember(
        team_id=invitation.team_id,
        user_id=user.id,
        role=invitation.role,
    )
    db.add(membership)
    invitation.is_used = True
    await db.flush()

    return TeamMemberResponse(
        id=membership.id,
        user_id=membership.user_id,
        role=membership.role,
        joined_at=membership.joined_at,
        user_email=user.email,
        user_nickname=user.nickname,
        user_avatar=getattr(user, "avatar", None),
    )
