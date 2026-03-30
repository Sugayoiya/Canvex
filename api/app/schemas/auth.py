from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    nickname: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class OAuthCallbackParams(BaseModel):
    code: str
    state: str


class UserResponse(BaseModel):
    id: str
    email: str
    nickname: str
    avatar: str | None = None
    is_admin: bool = False
    teams: list[dict] | None = None

    class Config:
        from_attributes = True
