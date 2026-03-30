from datetime import datetime

from pydantic import BaseModel


class UserSearchResult(BaseModel):
    id: str
    email: str
    nickname: str
    avatar: str | None = None

    model_config = {"from_attributes": True}


class UserProfileResponse(BaseModel):
    id: str
    email: str
    nickname: str
    avatar: str | None = None
    is_admin: bool = False
    created_at: datetime
    teams: list[dict] = []

    model_config = {"from_attributes": True}


class UserProfileUpdate(BaseModel):
    nickname: str | None = None
    avatar: str | None = None
