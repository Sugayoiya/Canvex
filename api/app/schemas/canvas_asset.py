import json
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator

VALID_ASSET_TYPES = {"text", "image", "video", "audio"}
MAX_CONFIG_JSON_SIZE = 50 * 1024  # 50 KB


class AssetCreate(BaseModel):
    project_id: str
    asset_type: str
    name: str = Field(..., min_length=1, max_length=255)
    tags: str | None = None
    content_text: str | None = None
    content_url: str | None = None
    config_json: dict[str, Any] | None = None
    source_node_id: str | None = None

    @field_validator("asset_type")
    @classmethod
    def validate_asset_type(cls, v: str) -> str:
        if v not in VALID_ASSET_TYPES:
            raise ValueError(f"asset_type must be one of {VALID_ASSET_TYPES}")
        return v

    @field_validator("config_json")
    @classmethod
    def validate_config_json_size(cls, v: dict[str, Any] | None) -> dict[str, Any] | None:
        if v is not None:
            size = len(json.dumps(v, ensure_ascii=False).encode("utf-8"))
            if size > MAX_CONFIG_JSON_SIZE:
                raise ValueError(f"config_json exceeds {MAX_CONFIG_JSON_SIZE // 1024}KB limit")
        return v


class AssetUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    tags: str | None = None
    config_json: dict[str, Any] | None = None

    @field_validator("config_json")
    @classmethod
    def validate_config_json_size(cls, v: dict[str, Any] | None) -> dict[str, Any] | None:
        if v is not None:
            size = len(json.dumps(v, ensure_ascii=False).encode("utf-8"))
            if size > MAX_CONFIG_JSON_SIZE:
                raise ValueError(f"config_json exceeds {MAX_CONFIG_JSON_SIZE // 1024}KB limit")
        return v


class AssetResponse(BaseModel):
    id: str
    project_id: str
    created_by: str
    asset_type: str
    name: str
    tags: str | None
    content_text: str | None
    content_url: str | None
    config_json: dict[str, Any] | None
    source_node_id: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AssetListResponse(BaseModel):
    items: list[AssetResponse]
    total: int
    limit: int
    offset: int
