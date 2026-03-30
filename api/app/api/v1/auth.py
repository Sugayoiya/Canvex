import secrets
import urllib.parse
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from jose import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_db, get_current_user
from app.core.security import (
    ALGORITHM,
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
)
from app.models.oauth_account import OAuthAccount
from app.models.user import User
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    RefreshRequest,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=req.email,
        password_hash=hash_password(req.password),
        nickname=req.nickname,
        status="active",
    )
    db.add(user)
    await db.flush()

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token()

    user.refresh_token = refresh_token
    user.refresh_token_expires = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()

    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user.status == "banned":
        raise HTTPException(status_code=403, detail="Account banned")

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token()

    user.refresh_token = refresh_token
    user.refresh_token_expires = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    user.last_login_at = datetime.now(timezone.utc)

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(req: RefreshRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(User.refresh_token == req.refresh_token)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    if user.refresh_token_expires and user.refresh_token_expires.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Refresh token expired")

    access_token = create_access_token(user.id)
    new_refresh = create_refresh_token()

    user.refresh_token = new_refresh
    user.refresh_token_expires = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    return TokenResponse(access_token=access_token, refresh_token=new_refresh)


@router.get("/me", response_model=UserResponse)
async def get_me(user=Depends(get_current_user)):
    return user


# ---------------------------------------------------------------------------
# OAuth helpers
# ---------------------------------------------------------------------------

def _create_oauth_state() -> str:
    return jwt.encode(
        {"nonce": secrets.token_hex(16), "exp": datetime.now(timezone.utc) + timedelta(minutes=10)},
        settings.SECRET_KEY,
        algorithm=ALGORITHM,
    )


def _verify_oauth_state(state: str) -> bool:
    try:
        jwt.decode(state, settings.SECRET_KEY, algorithms=[ALGORITHM])
        return True
    except Exception:
        return False


async def _find_or_create_oauth_user(
    provider: str,
    provider_user_id: str,
    email: str | None,
    name: str | None,
    avatar: str | None,
    db: AsyncSession,
) -> tuple[str, str]:
    result = await db.execute(
        select(OAuthAccount).where(
            OAuthAccount.provider == provider,
            OAuthAccount.provider_user_id == provider_user_id,
        )
    )
    oauth = result.scalar_one_or_none()

    if oauth:
        user_result = await db.execute(select(User).where(User.id == oauth.user_id))
        user = user_result.scalar_one()
    elif email:
        user_result = await db.execute(select(User).where(User.email == email))
        user = user_result.scalar_one_or_none()
        if user:
            oauth = OAuthAccount(
                user_id=user.id,
                provider=provider,
                provider_user_id=provider_user_id,
                provider_email=email,
            )
            db.add(oauth)
        else:
            user = User(
                email=email,
                nickname=name or email.split("@")[0],
                avatar=avatar,
                status="active",
            )
            db.add(user)
            await db.flush()
            oauth = OAuthAccount(
                user_id=user.id,
                provider=provider,
                provider_user_id=provider_user_id,
                provider_email=email,
            )
            db.add(oauth)
    else:
        raise HTTPException(status_code=400, detail="OAuth provider did not return an email")

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token()
    user.refresh_token = refresh_token
    user.refresh_token_expires = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    user.last_login_at = datetime.now(timezone.utc)

    return access_token, refresh_token


# ---------------------------------------------------------------------------
# Google OAuth
# ---------------------------------------------------------------------------

@router.get("/oauth/google/login")
async def google_login():
    state = _create_oauth_state()
    params = urllib.parse.urlencode({
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": f"{settings.FRONTEND_URL}/api/v1/auth/oauth/google/callback",
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "offline",
    })
    return {"url": f"https://accounts.google.com/o/oauth2/v2/auth?{params}"}


@router.get("/oauth/google/callback")
async def google_callback(code: str, state: str, db: AsyncSession = Depends(get_db)):
    if not _verify_oauth_state(state):
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

    async with httpx.AsyncClient() as client:
        token_resp = await client.post("https://oauth2.googleapis.com/token", data={
            "code": code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": f"{settings.FRONTEND_URL}/api/v1/auth/oauth/google/callback",
            "grant_type": "authorization_code",
        })
        if token_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Google token exchange failed")
        tokens = token_resp.json()

        user_resp = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        if user_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Google user info failed")
        info = user_resp.json()

    access_token, refresh_token = await _find_or_create_oauth_user(
        "google", str(info["id"]), info.get("email"), info.get("name"), info.get("picture"), db,
    )
    redirect_url = f"{settings.FRONTEND_URL}/login?access_token={access_token}&refresh_token={refresh_token}"
    return RedirectResponse(url=redirect_url)


# ---------------------------------------------------------------------------
# GitHub OAuth
# ---------------------------------------------------------------------------

@router.get("/oauth/github/login")
async def github_login():
    state = _create_oauth_state()
    params = urllib.parse.urlencode({
        "client_id": settings.GITHUB_CLIENT_ID,
        "redirect_uri": f"{settings.FRONTEND_URL}/api/v1/auth/oauth/github/callback",
        "scope": "user:email",
        "state": state,
    })
    return {"url": f"https://github.com/login/oauth/authorize?{params}"}


@router.get("/oauth/github/callback")
async def github_callback(code: str, state: str, db: AsyncSession = Depends(get_db)):
    if not _verify_oauth_state(state):
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://github.com/login/oauth/access_token",
            data={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": f"{settings.FRONTEND_URL}/api/v1/auth/oauth/github/callback",
            },
            headers={"Accept": "application/json"},
        )
        if token_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="GitHub token exchange failed")
        tokens = token_resp.json()
        gh_access_token = tokens.get("access_token")
        if not gh_access_token:
            raise HTTPException(status_code=400, detail="GitHub token exchange failed")

        user_resp = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {gh_access_token}", "Accept": "application/json"},
        )
        if user_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="GitHub user info failed")
        info = user_resp.json()

        email = info.get("email")
        if not email:
            emails_resp = await client.get(
                "https://api.github.com/user/emails",
                headers={"Authorization": f"Bearer {gh_access_token}", "Accept": "application/json"},
            )
            if emails_resp.status_code == 200:
                for entry in emails_resp.json():
                    if entry.get("primary") and entry.get("verified"):
                        email = entry["email"]
                        break

    access_token, refresh_token = await _find_or_create_oauth_user(
        "github", str(info["id"]), email, info.get("login"), info.get("avatar_url"), db,
    )
    redirect_url = f"{settings.FRONTEND_URL}/login?access_token={access_token}&refresh_token={refresh_token}"
    return RedirectResponse(url=redirect_url)
