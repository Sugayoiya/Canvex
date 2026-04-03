import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_user
from app.models.ai_provider_config import AIModelConfig, AIProviderConfig, AIProviderKey
from app.models.model_pricing import ModelPricing
from app.schemas.models import AvailableModel, AvailableModelsResponse, DefaultModelSettings

router = APIRouter(prefix="/models", tags=["models"])


@router.get("/available", response_model=AvailableModelsResponse)
async def get_available_models(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(AIModelConfig, ModelPricing, AIProviderConfig)
        .join(ModelPricing, ModelPricing.model_config_id == AIModelConfig.id)
        .join(AIProviderConfig, ModelPricing.provider_config_id == AIProviderConfig.id)
        .where(
            AIModelConfig.is_enabled == True,  # noqa: E712
            ModelPricing.is_active == True,  # noqa: E712
            AIProviderConfig.is_enabled == True,  # noqa: E712
            AIProviderConfig.keys.any(AIProviderKey.is_active == True),  # noqa: E712
        )
        .order_by(AIProviderConfig.priority.asc(), AIModelConfig.display_name.asc())
    )
    rows = (await db.execute(stmt)).all()

    llm_models, image_models = [], []
    seen: set[str] = set()
    for model_cfg, pricing, provider_cfg in rows:
        if model_cfg.model_name in seen:
            continue
        seen.add(model_cfg.model_name)
        features = json.loads(model_cfg.features) if model_cfg.features else []
        item = AvailableModel(
            model_name=model_cfg.model_name,
            display_name=model_cfg.display_name,
            model_type=model_cfg.model_type,
            provider_name=provider_cfg.provider_name,
            features=features,
            input_price_per_1k=pricing.input_price_per_1k,
            output_price_per_1k=pricing.output_price_per_1k,
            price_per_image=pricing.price_per_image,
        )
        if model_cfg.model_type == "llm":
            llm_models.append(item)
        else:
            image_models.append(item)

    return AvailableModelsResponse(llm=llm_models, image=image_models)


@router.get("/system-defaults")
async def get_system_defaults(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    from app.models.system_setting import SystemSetting
    llm = await db.get(SystemSetting, "default_llm_model")
    image = await db.get(SystemSetting, "default_image_model")
    return {
        "settings": {
            "default_llm_model": llm.value if llm else None,
            "default_image_model": image.value if image else None,
        }
    }


@router.patch("/system-defaults")
async def update_system_defaults(
    data: DefaultModelSettings,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    from app.models.system_setting import SystemSetting
    for key, val in [
        ("default_llm_model", data.default_llm_model),
        ("default_image_model", data.default_image_model),
    ]:
        if val is not None:
            existing = await db.get(SystemSetting, key)
            if existing:
                existing.value = val
            else:
                db.add(SystemSetting(key=key, value=val))
    await db.flush()
    llm = await db.get(SystemSetting, "default_llm_model")
    image = await db.get(SystemSetting, "default_image_model")
    return {
        "settings": {
            "default_llm_model": llm.value if llm else None,
            "default_image_model": image.value if image else None,
        }
    }
