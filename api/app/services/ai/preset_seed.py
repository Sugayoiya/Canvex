"""
Centralized preset seeding for Providers, Models, and Pricing.

Reads PROVIDER_META + _KNOWN_MODELS from each provider implementation.
Uses seed_version gating: only creates/updates records when code version > DB version.
Seed order: (1) providers, (2) models, (3) pricing associations.
"""
from __future__ import annotations

import json
import logging
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_provider_config import AIProviderConfig, AIModelConfig
from app.models.model_pricing import ModelPricing

logger = logging.getLogger(__name__)

CURRENT_SEED_VERSION = 2


def get_all_provider_metadata() -> list[dict]:
    """Import PROVIDER_META + _KNOWN_MODELS from each provider and return merged list."""
    from app.services.ai.model_providers.gemini import PROVIDER_META as gemini_meta, _KNOWN_MODELS as gemini_models
    from app.services.ai.model_providers.openai_provider import PROVIDER_META as openai_meta, _KNOWN_MODELS as openai_models
    from app.services.ai.model_providers.deepseek import PROVIDER_META as deepseek_meta, _KNOWN_MODELS as deepseek_models

    return [
        {**gemini_meta, "models": gemini_models},
        {**openai_meta, "models": openai_models},
        {**deepseek_meta, "models": deepseek_models},
    ]


async def seed_preset_providers(session: AsyncSession) -> None:
    """Seed system-level preset provider configs. Respects seed_version gating."""
    all_meta = get_all_provider_metadata()

    for idx, meta in enumerate(all_meta):
        provider_name = meta["provider_name"]
        existing = (await session.execute(
            select(AIProviderConfig).where(
                AIProviderConfig.provider_name == provider_name,
                AIProviderConfig.owner_type == "system",
            )
        )).scalar_one_or_none()

        if existing:
            if (existing.seed_version or 0) >= CURRENT_SEED_VERSION:
                continue
            existing.description = meta["description"]
            existing.icon = meta["icon"]
            existing.sdk_type = meta["sdk_type"]
            existing.default_base_url = meta.get("default_base_url")
            existing.is_preset = True
            existing.seed_version = CURRENT_SEED_VERSION
            logger.info("Updated preset provider: %s (seed_version → %d)", provider_name, CURRENT_SEED_VERSION)
        else:
            config = AIProviderConfig(
                provider_name=provider_name,
                display_name=meta["display_name"],
                description=meta["description"],
                icon=meta["icon"],
                sdk_type=meta["sdk_type"],
                default_base_url=meta.get("default_base_url"),
                is_preset=True,
                owner_type="system",
                priority=idx,
                seed_version=CURRENT_SEED_VERSION,
            )
            session.add(config)
            logger.info("Created preset provider: %s", provider_name)

    await session.flush()


async def seed_preset_models_and_pricing(session: AsyncSession) -> None:
    """Seed preset models and pricing associations. Respects seed_version gating."""
    all_meta = get_all_provider_metadata()

    provider_configs: dict[str, AIProviderConfig] = {}
    for meta in all_meta:
        config = (await session.execute(
            select(AIProviderConfig).where(
                AIProviderConfig.provider_name == meta["provider_name"],
                AIProviderConfig.owner_type == "system",
            )
        )).scalar_one_or_none()
        if config:
            provider_configs[meta["provider_name"]] = config

    for meta in all_meta:
        provider_name = meta["provider_name"]
        provider_config = provider_configs.get(provider_name)
        models_dict: dict[str, dict] = meta["models"]

        model_configs: dict[str, AIModelConfig] = {}

        for model_name, model_data in models_dict.items():
            existing_model = (await session.execute(
                select(AIModelConfig).where(AIModelConfig.model_name == model_name)
            )).scalar_one_or_none()

            if existing_model:
                if (existing_model.seed_version or 0) >= CURRENT_SEED_VERSION:
                    model_configs[model_name] = existing_model
                    continue
                existing_model.display_name = model_data.get("display_name", model_name)
                existing_model.input_token_limit = model_data.get("input_token_limit")
                existing_model.output_token_limit = model_data.get("output_token_limit")
                existing_model.features = json.dumps(model_data.get("features", [])) if model_data.get("features") else None
                existing_model.input_types = json.dumps(model_data.get("input_types", [])) if model_data.get("input_types") else None
                existing_model.output_types = json.dumps(model_data.get("output_types", [])) if model_data.get("output_types") else None
                existing_model.model_properties = json.dumps(model_data.get("model_properties")) if model_data.get("model_properties") else None
                existing_model.parameter_rules = json.dumps(model_data.get("parameter_rules", [])) if model_data.get("parameter_rules") else None
                existing_model.deprecated = model_data.get("deprecated", False)
                existing_model.is_preset = True
                existing_model.seed_version = CURRENT_SEED_VERSION
                model_configs[model_name] = existing_model
                logger.info("Updated preset model: %s", model_name)
            else:
                output_types = model_data.get("output_types", [])
                model_type = "image" if "image" in output_types else "llm"

                mc = AIModelConfig(
                    model_name=model_name,
                    display_name=model_data.get("display_name", model_name),
                    model_type=model_type,
                    features=json.dumps(model_data.get("features", [])) if model_data.get("features") else None,
                    input_types=json.dumps(model_data.get("input_types", [])) if model_data.get("input_types") else None,
                    output_types=json.dumps(output_types) if output_types else None,
                    model_properties=json.dumps(model_data.get("model_properties")) if model_data.get("model_properties") else None,
                    parameter_rules=json.dumps(model_data.get("parameter_rules", [])) if model_data.get("parameter_rules") else None,
                    deprecated=model_data.get("deprecated", False),
                    is_preset=True,
                    is_enabled=True,
                    input_token_limit=model_data.get("input_token_limit"),
                    output_token_limit=model_data.get("output_token_limit"),
                    seed_version=CURRENT_SEED_VERSION,
                )
                session.add(mc)
                model_configs[model_name] = mc
                logger.info("Created preset model: %s", model_name)

        await session.flush()

        if not provider_config:
            continue

        for model_name, model_data in models_dict.items():
            pricing_data = model_data.get("default_pricing")
            if not pricing_data:
                continue

            mc = model_configs.get(model_name)
            if not mc:
                continue

            existing_pricing = (await session.execute(
                select(ModelPricing).where(
                    ModelPricing.provider_config_id == provider_config.id,
                    ModelPricing.model_config_id == mc.id,
                )
            )).scalar_one_or_none()

            if not existing_pricing:
                existing_pricing = (await session.execute(
                    select(ModelPricing).where(
                        ModelPricing.provider == provider_name,
                        ModelPricing.model == model_name,
                    )
                )).scalar_one_or_none()

            if existing_pricing:
                if not existing_pricing.provider_config_id:
                    existing_pricing.provider_config_id = provider_config.id
                if not existing_pricing.model_config_id:
                    existing_pricing.model_config_id = mc.id
            else:
                output_types = model_data.get("output_types", [])
                model_type = "image" if "image" in output_types else "llm"

                pricing = ModelPricing(
                    provider=provider_name,
                    model=model_name,
                    model_type=model_type,
                    pricing_model=pricing_data["pricing_model"],
                    input_price_per_1k=Decimal(pricing_data["input_price_per_1k"]) if "input_price_per_1k" in pricing_data else None,
                    output_price_per_1k=Decimal(pricing_data["output_price_per_1k"]) if "output_price_per_1k" in pricing_data else None,
                    price_per_image=Decimal(pricing_data["price_per_image"]) if "price_per_image" in pricing_data else None,
                    provider_config_id=provider_config.id,
                    model_config_id=mc.id,
                )
                session.add(pricing)
                logger.info("Created pricing: %s / %s", provider_name, model_name)

        await session.flush()
