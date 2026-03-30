from pydantic import BaseModel
from datetime import datetime


class TeamCreate(BaseModel):
    name: str
    description: str | None = None


class TeamUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class TeamResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    avatar: str | None = None
    created_at: datetime
    member_count: int | None = None
    my_role: str | None = None

    class Config:
        from_attributes = True


class TeamMemberResponse(BaseModel):
    id: str
    user_id: str
    role: str
    joined_at: datetime
    user_email: str | None = None
    user_nickname: str | None = None
    user_avatar: str | None = None

    class Config:
        from_attributes = True


class AddMemberRequest(BaseModel):
    user_id: str
    role: str = "member"


class UpdateMemberRequest(BaseModel):
    role: str


class InvitationResponse(BaseModel):
    id: str
    token: str
    role: str
    expires_at: datetime
    is_used: bool
    invite_url: str | None = None

    class Config:
        from_attributes = True


class CreateInvitationRequest(BaseModel):
    role: str = "member"


class GroupCreate(BaseModel):
    name: str
    description: str | None = None


class GroupUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class GroupResponse(BaseModel):
    id: str
    team_id: str
    name: str
    description: str | None = None
    member_count: int | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class GroupMemberResponse(BaseModel):
    id: str
    user_id: str
    role: str
    joined_at: datetime
    user_email: str | None = None
    user_nickname: str | None = None

    class Config:
        from_attributes = True


class AddGroupMemberRequest(BaseModel):
    user_id: str
    role: str = "editor"


class UpdateGroupMemberRequest(BaseModel):
    role: str
