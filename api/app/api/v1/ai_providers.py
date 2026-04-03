import json
import logging
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, attributes

from app.core.deps import get_db, get_current_user, require_admin, require_team_member
from app.models.ai_provider_config import (
    AIProviderConfig,
    AIProviderKey,
    AIModelConfig,
)
from app.services.ai.provider_manager import encrypt_api_key
from app.services.admin_audit import AuditContext
from app.models.model_pricing import ModelPricing
from app.services.ai.parameter_templates import (
    PARAMETER_RULE_TEMPLATES,
    resolve_parameter_rules,
)
from app.schemas.ai_provider import (
    ProviderConfigCreate,
    ProviderConfigUpdate,
    ProviderConfigResponse,
    ProviderKeyCreate,
    ProviderKeyResponse,
    KeyHealthResponse,
    KeyUpdateRequest,
    ProviderHealthResponse,
    ModelConfigResponse,
    ProviderModelResponse,
    ModelPricingBrief,
    ModelCreateRequest,
    ModelUpdateRequest,
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
        description=getattr(config, "description", None),
        icon=getattr(config, "icon", None),
        sdk_type=getattr(config, "sdk_type", "native"),
        default_base_url=getattr(config, "default_base_url", None),
        base_url=getattr(config, "base_url", None),
        is_preset=getattr(config, "is_preset", False),
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

    if getattr(config, "is_preset", False):
        raise HTTPException(status_code=403, detail="Cannot delete preset provider")

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


def _parse_iso_datetime(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s)
    except (ValueError, TypeError):
        return None


def _compute_health_badge(error_count: int) -> str:
    if error_count == 0:
        return "healthy"
    elif error_count < 3:
        return "degraded"
    return "unhealthy"


@router.get("/{provider_id}/health", response_model=ProviderHealthResponse)
async def get_provider_health(
    provider_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Batch health for ALL keys of a provider. Avoids N+1 per-key fetches."""
    config = await _get_config_or_404(provider_id, user, db, load_keys=True)
    from app.services.ai.key_health import get_key_health_manager
    khm = get_key_health_manager()

    keys_health = []
    for key in config.keys:
        health = await khm.get_health(key.id)
        errors = await khm.get_recent_errors(key.id)
        usage = await khm.get_usage_trend(key.id, hours=24)
        error_count = health["error_count"]

        keys_health.append(KeyHealthResponse(
            key_id=key.id,
            error_count=error_count,
            last_used_at=_parse_iso_datetime(health.get("last_used_at")),
            is_healthy=health["is_healthy"],
            health_badge=_compute_health_badge(error_count),
            recent_errors=errors,
            usage_trend=usage,
        ))

    return ProviderHealthResponse(provider_id=provider_id, keys=keys_health)


@router.get("/{provider_id}/keys/{key_id}/health", response_model=KeyHealthResponse)
async def get_key_health(
    provider_id: str,
    key_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Per-key health status."""
    await _get_config_or_404(provider_id, user, db)
    key_result = await db.execute(
        select(AIProviderKey).where(
            AIProviderKey.id == key_id,
            AIProviderKey.provider_config_id == provider_id,
        )
    )
    key_obj = key_result.scalar_one_or_none()
    if not key_obj:
        raise HTTPException(status_code=404, detail="Key not found")

    from app.services.ai.key_health import get_key_health_manager
    khm = get_key_health_manager()
    health = await khm.get_health(key_id)
    errors = await khm.get_recent_errors(key_id)
    usage = await khm.get_usage_trend(key_id, hours=24)
    error_count = health["error_count"]

    return KeyHealthResponse(
        key_id=key_id,
        error_count=error_count,
        last_used_at=_parse_iso_datetime(health.get("last_used_at")),
        is_healthy=health["is_healthy"],
        health_badge=_compute_health_badge(error_count),
        recent_errors=errors,
        usage_trend=usage,
    )


@router.patch("/{provider_id}/keys/{key_id}", response_model=ProviderKeyResponse)
async def update_key(
    provider_id: str,
    key_id: str,
    data: KeyUpdateRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Toggle key active/inactive or reset error count."""
    config = await _get_config_or_404(provider_id, user, db, load_keys=True)
    key_result = await db.execute(
        select(AIProviderKey).where(
            AIProviderKey.id == key_id,
            AIProviderKey.provider_config_id == provider_id,
        )
    )
    key_obj = key_result.scalar_one_or_none()
    if not key_obj:
        raise HTTPException(status_code=404, detail="Key not found")

    from app.services.ai.key_health import get_key_health_manager
    from app.services.ai.credential_cache import get_credential_cache

    old_active = key_obj.is_active
    changes: dict = {}

    if data.is_active is not None and data.is_active != old_active:
        key_obj.is_active = data.is_active
        changes["is_active"] = {"old": old_active, "new": data.is_active}

    if data.reset_error_count:
        key_obj.error_count = 0
        await get_key_health_manager().reset_error_count(key_id)
        changes["error_count"] = {"old": "N/A", "new": 0}

    await db.flush()

    await get_credential_cache().invalidate(
        config.provider_name, config.owner_type, config.owner_id
    )

    if changes:
        audit = AuditContext(db, user.id)
        await audit.log_if(
            config.owner_type == "system",
            action_type="provider.key.update",
            target_type="ai_provider_key",
            target_id=key_id,
            changes=changes,
        )

    await db.commit()

    return ProviderKeyResponse(
        id=key_obj.id,
        label=key_obj.label,
        key_hint=key_obj.key_hint,
        is_active=key_obj.is_active,
        last_used_at=key_obj.last_used_at,
        created_at=key_obj.created_at,
    )


@router.get("/models", response_model=list[ModelConfigResponse])
async def list_models(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AIModelConfig)
        .where(AIModelConfig.is_enabled == True)  # noqa: E712
    )
    models = result.scalars().all()

    responses = []
    for mc in models:
        pricing_result = await db.execute(
            select(ModelPricing)
            .where(ModelPricing.model_config_id == mc.id, ModelPricing.is_active == True)  # noqa: E712
            .options(selectinload(ModelPricing.provider_config))
        )
        pricings = pricing_result.scalars().all()
        provider_names = [
            p.provider_config.display_name
            for p in pricings if p.provider_config
        ]
        responses.append(ModelConfigResponse.from_model_config(mc, provider_names))
    return responses


def _parse_json_field(value: str | None) -> list | dict | None:
    if not value:
        return None
    try:
        return json.loads(value) if isinstance(value, str) else value
    except (json.JSONDecodeError, TypeError):
        return None


def _model_to_response(mc: AIModelConfig, pricing: ModelPricing | None = None) -> ProviderModelResponse:
    raw_rules = _parse_json_field(mc.parameter_rules) or []
    return ProviderModelResponse(
        id=mc.id,
        display_name=mc.display_name,
        model_name=mc.model_name,
        model_type=mc.model_type,
        features=_parse_json_field(mc.features) or [],
        is_enabled=mc.is_enabled,
        is_preset=mc.is_preset,
        input_token_limit=mc.input_token_limit,
        output_token_limit=mc.output_token_limit,
        input_types=_parse_json_field(mc.input_types) or [],
        output_types=_parse_json_field(mc.output_types) or [],
        model_properties=_parse_json_field(mc.model_properties),
        parameter_rules=resolve_parameter_rules(raw_rules),
        deprecated=mc.deprecated if mc.deprecated is not None else False,
        pricing=ModelPricingBrief(
            id=pricing.id,
            pricing_model=pricing.pricing_model,
            input_price_per_1k=pricing.input_price_per_1k,
            output_price_per_1k=pricing.output_price_per_1k,
            price_per_image=pricing.price_per_image,
            price_per_second=pricing.price_per_second,
            is_active=pricing.is_active,
        ) if pricing else None,
    )


@router.get("/parameter-templates")
async def get_parameter_templates(user=Depends(get_current_user)):
    """Return the preset ParameterRule templates for the frontend form."""
    return PARAMETER_RULE_TEMPLATES


@router.get("/{provider_id}/models", response_model=list[ProviderModelResponse])
async def list_provider_models(
    provider_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List models associated with a provider via ModelPricing join."""
    await _get_config_or_404(provider_id, user, db)

    stmt = (
        select(AIModelConfig, ModelPricing)
        .outerjoin(
            ModelPricing,
            (ModelPricing.model_config_id == AIModelConfig.id)
            & (ModelPricing.provider_config_id == provider_id)
            & (ModelPricing.is_active == True)  # noqa: E712
        )
        .where(ModelPricing.provider_config_id == provider_id)
    )
    result = await db.execute(stmt)
    rows = result.all()

    return [_model_to_response(mc, pricing) for mc, pricing in rows]


@router.post("/{provider_id}/models", response_model=ProviderModelResponse, status_code=status.HTTP_201_CREATED)
async def create_provider_model(
    provider_id: str,
    data: ModelCreateRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a custom model and associate it with a provider via ModelPricing."""
    config = await _get_config_or_404(provider_id, user, db)
    require_admin(user)

    existing = (await db.execute(
        select(AIModelConfig).where(AIModelConfig.model_name == data.model_name)
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail=f"Model '{data.model_name}' already exists")

    rules_raw = [r.model_dump(exclude_none=True) for r in data.parameter_rules] if data.parameter_rules else []

    model = AIModelConfig(
        display_name=data.display_name,
        model_name=data.model_name,
        model_type=data.model_type,
        features=json.dumps(data.features) if data.features else None,
        input_types=json.dumps(data.input_types) if data.input_types else None,
        output_types=json.dumps(data.output_types) if data.output_types else None,
        model_properties=json.dumps(data.model_properties) if data.model_properties else None,
        parameter_rules=json.dumps(rules_raw) if rules_raw else None,
        input_token_limit=data.input_token_limit,
        output_token_limit=data.output_token_limit,
        deprecated=data.deprecated,
        is_preset=False,
    )
    db.add(model)
    await db.flush()

    pricing_model = data.pricing_model or "per_token"
    pricing = ModelPricing(
        provider=config.provider_name,
        model=data.model_name,
        model_type=data.model_type,
        pricing_model=pricing_model,
        input_price_per_1k=Decimal(data.input_price_per_1k) if data.input_price_per_1k else None,
        output_price_per_1k=Decimal(data.output_price_per_1k) if data.output_price_per_1k else None,
        price_per_image=Decimal(data.price_per_image) if data.price_per_image else None,
        provider_config_id=provider_id,
        model_config_id=model.id,
    )
    db.add(pricing)
    await db.flush()

    audit = AuditContext(db, user.id)
    await audit.log_if(config.owner_type == "system",
        action_type="provider.model.create", target_type="ai_model_config",
        target_id=model.id,
        changes={"model": {"old": None, "new": {"model_name": data.model_name, "display_name": data.display_name}}})

    return _model_to_response(model, pricing)


@router.patch("/{provider_id}/models/{model_id}", response_model=ProviderModelResponse)
async def update_provider_model(
    provider_id: str,
    model_id: str,
    data: ModelUpdateRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update model configuration fields."""
    config = await _get_config_or_404(provider_id, user, db)
    require_admin(user)

    model = (await db.execute(
        select(AIModelConfig).where(AIModelConfig.id == model_id)
    )).scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    changes = {}
    update_fields = data.model_dump(exclude_unset=True)

    json_list_fields = {"features", "input_types", "output_types"}
    json_dict_fields = {"model_properties"}
    json_rules_field = "parameter_rules"
    pricing_fields = {"pricing_model", "input_price_per_1k", "output_price_per_1k", "price_per_image"}

    for field, value in update_fields.items():
        if field in pricing_fields:
            continue
        if field in json_list_fields:
            old = getattr(model, field)
            new_val = json.dumps(value) if value is not None else None
            if old != new_val:
                changes[field] = {"old": old, "new": new_val}
                setattr(model, field, new_val)
        elif field in json_dict_fields:
            old = getattr(model, field)
            new_val = json.dumps(value) if value is not None else None
            if old != new_val:
                changes[field] = {"old": old, "new": new_val}
                setattr(model, field, new_val)
        elif field == json_rules_field:
            rules_raw = [r.model_dump(exclude_none=True) if hasattr(r, 'model_dump') else r for r in value] if value is not None else None
            new_val = json.dumps(rules_raw) if rules_raw is not None else None
            old = getattr(model, field)
            if old != new_val:
                changes[field] = {"old": old, "new": new_val}
                setattr(model, field, new_val)
        else:
            old = getattr(model, field, None)
            if old != value:
                changes[field] = {"old": old, "new": value}
                setattr(model, field, value)

    if any(f in update_fields for f in pricing_fields):
        pricing_result = await db.execute(
            select(ModelPricing).where(
                ModelPricing.model_config_id == model_id,
                ModelPricing.provider_config_id == provider_id,
            )
        )
        pricing = pricing_result.scalar_one_or_none()
        if pricing:
            if "pricing_model" in update_fields and update_fields["pricing_model"]:
                pricing.pricing_model = update_fields["pricing_model"]
            if "input_price_per_1k" in update_fields:
                pricing.input_price_per_1k = Decimal(update_fields["input_price_per_1k"]) if update_fields["input_price_per_1k"] else None
            if "output_price_per_1k" in update_fields:
                pricing.output_price_per_1k = Decimal(update_fields["output_price_per_1k"]) if update_fields["output_price_per_1k"] else None
            if "price_per_image" in update_fields:
                pricing.price_per_image = Decimal(update_fields["price_per_image"]) if update_fields["price_per_image"] else None

    await db.flush()

    if changes:
        audit = AuditContext(db, user.id)
        await audit.log_if(config.owner_type == "system",
            action_type="provider.model.update", target_type="ai_model_config",
            target_id=model_id, changes=changes)

    pricing_obj = (await db.execute(
        select(ModelPricing).where(
            ModelPricing.model_config_id == model_id,
            ModelPricing.provider_config_id == provider_id,
            ModelPricing.is_active == True,  # noqa: E712
        )
    )).scalar_one_or_none()

    return _model_to_response(model, pricing_obj)
