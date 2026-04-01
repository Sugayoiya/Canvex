import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, attributes

from app.core.deps import get_db, get_current_user, require_admin, require_team_member
from app.models.ai_provider_config import (
    AIProviderConfig,
    AIProviderKey,
    AIModelConfig,
    AIModelProviderMapping,
)
from app.services.ai.provider_manager import encrypt_api_key
from app.services.admin_audit import AuditContext
from app.schemas.ai_provider import (
    ProviderConfigCreate,
    ProviderConfigUpdate,
    ProviderConfigResponse,
    ProviderKeyCreate,
    ProviderKeyResponse,
    ModelConfigResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai-providers", tags=["ai-providers"])


async def _verify_config_ownership(config: AIProviderConfig, user, db: AsyncSession):
    """Verify the user has permission to manage a provider config."""
    if config.owner_type == "system":
        require_admin(user)
    elif config.owner_type == "team":
        await require_team_member(config.owner_id, user, db, min_role="team_admin")
    elif config.owner_type == "personal":
        if config.owner_id != user.id:
            raise HTTPException(status_code=403, detail="Access denied")


async def _get_config_or_404(
    provider_id: str, user, db: AsyncSession, *, load_keys: bool = False,
) -> AIProviderConfig:
    """Fetch config, verify ownership, raise 404 if missing."""
    stmt = select(AIProviderConfig).where(AIProviderConfig.id == provider_id)
    if load_keys:
        stmt = stmt.options(selectinload(AIProviderConfig.keys))
    config = (await db.execute(stmt)).scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="Provider config not found")
    await _verify_config_ownership(config, user, db)
    return config


def _config_to_response(config: AIProviderConfig) -> ProviderConfigResponse:
    keys = config.keys if config.keys else []
    return ProviderConfigResponse(
        id=config.id,
        provider_name=config.provider_name,
        display_name=config.display_name,
        is_enabled=config.is_enabled,
        priority=config.priority,
        owner_type=config.owner_type,
        owner_id=config.owner_id,
        key_count=len(keys),
        active_key_count=sum(1 for k in keys if k.is_active),
        keys=[ProviderKeyResponse(
            id=k.id, label=k.label, key_hint=getattr(k, "key_hint", None),
            is_active=k.is_active,
            last_used_at=k.last_used_at, created_at=k.created_at,
        ) for k in keys],
        created_at=config.created_at,
    )


@router.get("/", response_model=list[ProviderConfigResponse])
async def list_providers(
    owner_type: str = Query("system"),
    owner_id: str | None = Query(None),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if owner_type == "system":
        require_admin(user)
        stmt = (
            select(AIProviderConfig)
            .where(AIProviderConfig.owner_type == "system")
            .options(selectinload(AIProviderConfig.keys))
        )
    elif owner_type == "team":
        if not owner_id:
            raise HTTPException(status_code=400, detail="owner_id required for team providers")
        await require_team_member(owner_id, user, db, min_role="member")
        stmt = (
            select(AIProviderConfig)
            .where(AIProviderConfig.owner_type == "team", AIProviderConfig.owner_id == owner_id)
            .options(selectinload(AIProviderConfig.keys))
        )
    elif owner_type == "personal":
        stmt = (
            select(AIProviderConfig)
            .where(AIProviderConfig.owner_type == "personal", AIProviderConfig.owner_id == user.id)
            .options(selectinload(AIProviderConfig.keys))
        )
    else:
        raise HTTPException(status_code=400, detail=f"Invalid owner_type: {owner_type}")

    result = await db.execute(stmt)
    configs = result.scalars().all()
    return [_config_to_response(c) for c in configs]


@router.post("/", response_model=ProviderConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_provider(
    data: ProviderConfigCreate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.owner_type == "system":
        require_admin(user)
    elif data.owner_type == "team":
        if not data.owner_id:
            raise HTTPException(status_code=400, detail="owner_id required for team providers")
        await require_team_member(data.owner_id, user, db, min_role="team_admin")
    elif data.owner_type == "personal":
        data.owner_id = user.id

    config = AIProviderConfig(
        provider_name=data.provider_name,
        display_name=data.display_name,
        is_enabled=data.is_enabled,
        priority=data.priority,
        owner_type=data.owner_type,
        owner_id=data.owner_id,
    )
    db.add(config)
    await db.flush()

    attributes.set_committed_value(config, "keys", [])

    audit = AuditContext(db, user.id)
    await audit.log_if(data.owner_type == "system",
        action_type="provider.create", target_type="ai_provider_config",
        target_id=config.id,
        changes={"provider": {"old": None, "new": {"provider_name": config.provider_name, "display_name": config.display_name, "is_enabled": config.is_enabled}}})

    return _config_to_response(config)


@router.patch("/{provider_id}", response_model=ProviderConfigResponse)
async def update_provider(
    provider_id: str,
    data: ProviderConfigUpdate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    config = await _get_config_or_404(provider_id, user, db, load_keys=True)

    update_data = data.model_dump(exclude_unset=True)
    old_snapshot = {k: getattr(config, k) for k in update_data}
    for key, value in update_data.items():
        setattr(config, key, value)
    await db.flush()

    audit = AuditContext(db, user.id)
    await audit.log_if(config.owner_type == "system",
        action_type="provider.update", target_type="ai_provider_config",
        target_id=provider_id,
        changes={"provider": {"old": old_snapshot, "new": update_data}})

    return _config_to_response(config)


@router.delete("/{provider_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_provider(
    provider_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    config = await _get_config_or_404(provider_id, user, db)

    audit = AuditContext(db, user.id)
    await audit.log_if(config.owner_type == "system",
        action_type="provider.delete", target_type="ai_provider_config",
        target_id=provider_id,
        changes={"provider": {"old": {"provider_name": config.provider_name, "display_name": config.display_name}, "new": None}})

    await db.delete(config)
    await db.flush()


@router.post("/{provider_id}/keys", response_model=ProviderKeyResponse, status_code=status.HTTP_201_CREATED)
async def add_provider_key(
    provider_id: str,
    data: ProviderKeyCreate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    config = await _get_config_or_404(provider_id, user, db)

    key = AIProviderKey(
        provider_config_id=provider_id,
        api_key_encrypted=encrypt_api_key(data.api_key),
        label=data.label,
        key_hint=data.api_key[-4:] if len(data.api_key) >= 4 else data.api_key,
    )
    db.add(key)
    await db.flush()

    audit = AuditContext(db, user.id)
    await audit.log_if(config.owner_type == "system",
        action_type="provider.key.add", target_type="ai_provider_key",
        target_id=key.id,
        changes={"key": {"old": None, "new": {"label": key.label, "provider_config_id": provider_id}}})

    return ProviderKeyResponse(
        id=key.id,
        label=key.label,
        key_hint=key.key_hint,
        is_active=key.is_active,
        last_used_at=key.last_used_at,
        created_at=key.created_at,
    )


@router.delete("/{provider_id}/keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_provider_key(
    provider_id: str,
    key_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    config = await _get_config_or_404(provider_id, user, db)

    key_result = await db.execute(
        select(AIProviderKey).where(
            AIProviderKey.id == key_id,
            AIProviderKey.provider_config_id == provider_id,
        )
    )
    key = key_result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=404, detail="Key not found")

    audit = AuditContext(db, user.id)
    await audit.log_if(config.owner_type == "system",
        action_type="provider.key.delete", target_type="ai_provider_key",
        target_id=key_id,
        changes={"key": {"old": {"label": key.label, "provider_config_id": provider_id}, "new": None}})

    await db.delete(key)
    await db.flush()


@router.get("/models", response_model=list[ModelConfigResponse])
async def list_models(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AIModelConfig)
        .where(AIModelConfig.is_enabled == True)  # noqa: E712
        .options(selectinload(AIModelConfig.provider_mappings).selectinload(AIModelProviderMapping.provider_config))
    )
    models = result.scalars().all()

    responses = []
    for mc in models:
        provider_names = [
            m.provider_config.display_name
            for m in (mc.provider_mappings or [])
            if m.provider_config
        ]
        responses.append(ModelConfigResponse.from_model_config(mc, provider_names))
    return responses
