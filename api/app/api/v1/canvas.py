from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_db, get_current_user, resolve_project_access
from app.models.canvas import Canvas, CanvasNode, CanvasEdge
from app.schemas.canvas import (
    VALID_NODE_TYPES,
    CanvasCreate,
    CanvasUpdate,
    CanvasResponse,
    CanvasDetailResponse,
    NodeCreate,
    NodeUpdate,
    NodeResponse,
    EdgeCreate,
    EdgeResponse,
    BatchExecuteRequest,
    BatchExecuteResponse,
    BatchStatusResponse,
    BatchNodeUpdateRequest,
)
from app.services.graph_execution_service import BatchExecutionService

router = APIRouter(prefix="/canvas", tags=["canvas"])


# ---------------------------------------------------------------------------
# Canvas CRUD
# ---------------------------------------------------------------------------

@router.post("/", response_model=CanvasResponse)
async def create_canvas(
    req: CanvasCreate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await resolve_project_access(req.project_id, user, db)
    canvas = Canvas(project_id=req.project_id, name=req.name)
    db.add(canvas)
    await db.flush()
    await db.refresh(canvas)
    return canvas


@router.get("/", response_model=list[CanvasResponse])
async def list_canvases(
    project_id: str = Query(...),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await resolve_project_access(project_id, user, db)
    result = await db.execute(
        select(Canvas).where(
            Canvas.project_id == project_id,
            Canvas.is_deleted == False,  # noqa: E712
        )
    )
    return result.scalars().all()


@router.get("/{canvas_id}", response_model=CanvasDetailResponse)
async def get_canvas(
    canvas_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    canvas = await _load_canvas(canvas_id, db)
    await resolve_project_access(canvas.project_id, user, db)
    result = await db.execute(
        select(Canvas)
        .where(Canvas.id == canvas_id)
        .options(selectinload(Canvas.nodes), selectinload(Canvas.edges))
    )
    return result.scalar_one()


@router.patch("/{canvas_id}", response_model=CanvasResponse)
async def update_canvas(
    canvas_id: str,
    req: CanvasUpdate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    canvas = await _load_canvas(canvas_id, db)
    await resolve_project_access(canvas.project_id, user, db)
    for key, value in req.model_dump(exclude_unset=True).items():
        setattr(canvas, key, value)
    await db.flush()
    await db.refresh(canvas)
    return canvas


@router.delete("/{canvas_id}", status_code=204)
async def delete_canvas(
    canvas_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    canvas = await _load_canvas(canvas_id, db)
    await resolve_project_access(canvas.project_id, user, db)
    canvas.soft_delete()
    await db.flush()


# ---------------------------------------------------------------------------
# Node CRUD
# ---------------------------------------------------------------------------

@router.post("/nodes/", response_model=NodeResponse)
async def create_node(
    req: NodeCreate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    canvas = await _load_canvas(req.canvas_id, db)
    await resolve_project_access(canvas.project_id, user, db)
    if req.node_type not in VALID_NODE_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid node_type '{req.node_type}'. Must be one of: {sorted(VALID_NODE_TYPES)}",
        )
    node = CanvasNode(
        canvas_id=req.canvas_id,
        node_type=req.node_type,
        position_x=req.position_x,
        position_y=req.position_y,
        config=req.config,
    )
    db.add(node)
    await db.flush()
    await db.refresh(node)
    return node


@router.patch("/nodes/{node_id}", response_model=NodeResponse)
async def update_node(
    node_id: str,
    req: NodeUpdate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    node = await _load_node_with_access(node_id, user, db)
    for key, value in req.model_dump(exclude_unset=True).items():
        setattr(node, key, value)
    await db.flush()
    await db.refresh(node)
    return node


@router.delete("/nodes/{node_id}", status_code=204)
async def delete_node(
    node_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(CanvasNode).where(CanvasNode.id == node_id))
    node = result.scalar_one_or_none()
    if node is None:
        return  # idempotent: already deleted
    canvas = await _load_canvas(node.canvas_id, db)
    await resolve_project_access(canvas.project_id, user, db)
    # Explicitly delete edges referencing this node before removing the node
    edges = await db.execute(
        select(CanvasEdge).where(
            CanvasEdge.canvas_id == node.canvas_id,
            (CanvasEdge.source_node_id == node_id) | (CanvasEdge.target_node_id == node_id),
        )
    )
    for edge in edges.scalars().all():
        await db.delete(edge)
    await db.delete(node)
    await db.flush()


# ---------------------------------------------------------------------------
# Edge CRUD
# ---------------------------------------------------------------------------

@router.post("/edges/", response_model=EdgeResponse)
async def create_edge(
    req: EdgeCreate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    canvas = await _load_canvas(req.canvas_id, db)
    await resolve_project_access(canvas.project_id, user, db)

    if req.source_node_id == req.target_node_id:
        raise HTTPException(status_code=422, detail="Self-loop edges are not allowed")

    source = await db.execute(
        select(CanvasNode).where(
            CanvasNode.id == req.source_node_id,
            CanvasNode.canvas_id == req.canvas_id,
        )
    )
    if source.scalar_one_or_none() is None:
        raise HTTPException(status_code=422, detail="source_node_id does not belong to this canvas")

    target = await db.execute(
        select(CanvasNode).where(
            CanvasNode.id == req.target_node_id,
            CanvasNode.canvas_id == req.canvas_id,
        )
    )
    if target.scalar_one_or_none() is None:
        raise HTTPException(status_code=422, detail="target_node_id does not belong to this canvas")

    edge = CanvasEdge(
        canvas_id=req.canvas_id,
        source_node_id=req.source_node_id,
        target_node_id=req.target_node_id,
        source_handle=req.source_handle,
        target_handle=req.target_handle,
    )
    db.add(edge)
    await db.flush()
    await db.refresh(edge)
    return edge


@router.delete("/edges/{edge_id}", status_code=204)
async def delete_edge(
    edge_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(CanvasEdge).where(CanvasEdge.id == edge_id))
    edge = result.scalar_one_or_none()
    if edge is None:
        return  # idempotent: already deleted (e.g. via node cascade)
    canvas = await _load_canvas(edge.canvas_id, db)
    await resolve_project_access(canvas.project_id, user, db)
    await db.delete(edge)
    await db.flush()


# ---------------------------------------------------------------------------
# Batch execution
# ---------------------------------------------------------------------------

@router.post("/batch-execute", response_model=BatchExecuteResponse)
async def batch_execute(
    req: BatchExecuteRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    canvas = await _load_canvas(req.canvas_id, db)
    await resolve_project_access(canvas.project_id, user, db)
    svc = BatchExecutionService(db, user)
    batch = await svc.start_batch(req.canvas_id, req.node_ids)
    return BatchExecuteResponse(
        batch_id=batch.id, layers=batch.layers, total_nodes=batch.total_nodes
    )


@router.get("/batch-execute/{batch_id}", response_model=BatchStatusResponse)
async def get_batch_status(
    batch_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = BatchExecutionService(db, user)
    batch = await svc.get_batch_status(batch_id)
    return BatchStatusResponse(
        batch_id=batch.id,
        layers=batch.layers,
        node_statuses=batch.node_statuses,
        current_layer=batch.current_layer,
        status=batch.status,
    )


@router.patch("/batch-execute/{batch_id}/nodes/{node_id}")
async def update_batch_node_status(
    batch_id: str,
    node_id: str,
    body: BatchNodeUpdateRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = BatchExecutionService(db, user)
    await svc.update_node_status(batch_id, node_id, body.status)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _load_canvas(canvas_id: str, db: AsyncSession) -> Canvas:
    result = await db.execute(
        select(Canvas).where(Canvas.id == canvas_id, Canvas.is_deleted == False)  # noqa: E712
    )
    canvas = result.scalar_one_or_none()
    if canvas is None:
        raise HTTPException(status_code=404, detail="Canvas not found")
    return canvas


async def _load_node_with_access(node_id: str, user, db: AsyncSession) -> CanvasNode:
    result = await db.execute(select(CanvasNode).where(CanvasNode.id == node_id))
    node = result.scalar_one_or_none()
    if node is None:
        raise HTTPException(status_code=404, detail="Node not found")
    canvas = await _load_canvas(node.canvas_id, db)
    await resolve_project_access(canvas.project_id, user, db)
    return node
