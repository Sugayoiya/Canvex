from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_user, resolve_project_access
from app.models.canvas_asset import CanvasAsset
from app.schemas.canvas_asset import (
    AssetCreate,
    AssetUpdate,
    AssetResponse,
    AssetListResponse,
)

router = APIRouter(prefix="/canvas/assets", tags=["canvas-assets"])


@router.get("/", response_model=AssetListResponse)
async def list_assets(
    project_id: str = Query(...),
    asset_type: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await resolve_project_access(project_id, user, db, min_role="viewer")
    query = select(CanvasAsset).where(
        CanvasAsset.project_id == project_id,
        CanvasAsset.is_deleted == False,  # noqa: E712
    )
    if asset_type:
        query = query.where(CanvasAsset.asset_type == asset_type)

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    rows = await db.execute(
        query.order_by(CanvasAsset.created_at.desc()).limit(limit).offset(offset)
    )
    items = rows.scalars().all()
    return AssetListResponse(items=items, total=total, limit=limit, offset=offset)


@router.post("/", response_model=AssetResponse, status_code=201)
async def create_asset(
    req: AssetCreate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await resolve_project_access(req.project_id, user, db)
    asset = CanvasAsset(**req.model_dump(), created_by=user.id)
    db.add(asset)
    await db.flush()
    await db.refresh(asset)
    return asset


@router.get("/{asset_id}", response_model=AssetResponse)
async def get_asset(
    asset_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    asset = (
        await db.execute(
            select(CanvasAsset).where(
                CanvasAsset.id == asset_id,
                CanvasAsset.is_deleted == False,  # noqa: E712
            )
        )
    ).scalar_one_or_none()
    if not asset:
        raise HTTPException(404, "Asset not found")
    await resolve_project_access(asset.project_id, user, db, min_role="viewer")
    return asset


@router.patch("/{asset_id}", response_model=AssetResponse)
async def update_asset(
    asset_id: str,
    req: AssetUpdate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    asset = (
        await db.execute(
            select(CanvasAsset).where(
                CanvasAsset.id == asset_id,
                CanvasAsset.is_deleted == False,  # noqa: E712
            )
        )
    ).scalar_one_or_none()
    if not asset:
        raise HTTPException(404, "Asset not found")
    await resolve_project_access(asset.project_id, user, db)
    for key, val in req.model_dump(exclude_unset=True).items():
        setattr(asset, key, val)
    await db.flush()
    await db.refresh(asset)
    return asset


@router.delete("/{asset_id}", status_code=204)
async def delete_asset(
    asset_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    asset = (
        await db.execute(
            select(CanvasAsset).where(
                CanvasAsset.id == asset_id,
                CanvasAsset.is_deleted == False,  # noqa: E712
            )
        )
    ).scalar_one_or_none()
    if not asset:
        raise HTTPException(404, "Asset not found")
    await resolve_project_access(asset.project_id, user, db)
    asset.soft_delete()
    await db.flush()
