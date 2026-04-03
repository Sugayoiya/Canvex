import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_db, get_current_user, require_team_member, resolve_project_access
from app.models.project import Project
from app.models.canvas import Canvas, CanvasNode, CanvasEdge
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectCloneRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects", tags=["projects"])


def _project_to_response(project: Project, canvas_count: int = 0) -> ProjectResponse:
    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        owner_type=project.owner_type,
        owner_id=project.owner_id,
        created_by=project.created_by,
        aspect_ratio=project.aspect_ratio,
        settings=project.settings,
        created_at=project.created_at,
        updated_at=project.updated_at,
        canvas_count=canvas_count,
    )


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    data: ProjectCreate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.owner_type == "team":
        if not data.owner_id:
            raise HTTPException(status_code=400, detail="owner_id required for team projects")
        await require_team_member(data.owner_id, user, db, min_role="member")
        owner_id = data.owner_id
    else:
        owner_id = user.id

    project = Project(
        id=str(uuid.uuid4()),
        name=data.name,
        description=data.description,
        owner_type=data.owner_type,
        owner_id=owner_id,
        created_by=user.id,
    )
    db.add(project)
    await db.flush()
    return _project_to_response(project)


@router.get("/", response_model=list[ProjectResponse])
async def list_projects(
    owner_type: str = Query("personal"),
    owner_id: str | None = Query(None),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    canvas_count_sub = (
        select(func.count(Canvas.id))
        .where(Canvas.project_id == Project.id, Canvas.is_deleted == False)  # noqa: E712
        .correlate(Project)
        .scalar_subquery()
    )

    if owner_type == "team":
        if not owner_id:
            raise HTTPException(status_code=400, detail="owner_id required for team projects")
        await require_team_member(owner_id, user, db, min_role="member")
        stmt = (
            select(Project, canvas_count_sub.label("canvas_count"))
            .where(
                Project.owner_type == "team",
                Project.owner_id == owner_id,
                Project.is_deleted == False,  # noqa: E712
            )
            .order_by(Project.created_at.desc())
        )
    else:
        stmt = (
            select(Project, canvas_count_sub.label("canvas_count"))
            .where(
                Project.owner_type == "personal",
                Project.owner_id == user.id,
                Project.is_deleted == False,  # noqa: E712
            )
            .order_by(Project.created_at.desc())
        )

    result = await db.execute(stmt)
    rows = result.all()
    return [_project_to_response(row[0], canvas_count=row[1] or 0) for row in rows]


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project, _role = await resolve_project_access(project_id, user, db, min_role="viewer")
    count_result = await db.execute(
        select(func.count(Canvas.id)).where(
            Canvas.project_id == project_id,
            Canvas.is_deleted == False,  # noqa: E712
        )
    )
    canvas_count = count_result.scalar() or 0
    return _project_to_response(project, canvas_count=canvas_count)


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    data: ProjectUpdate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project, _role = await resolve_project_access(project_id, user, db, min_role="editor")
    update_data = data.model_dump(exclude_unset=True)
    if "settings" in update_data and update_data["settings"] is not None:
        current = dict(project.settings or {})
        current.update(update_data.pop("settings"))
        project.settings = current
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(project, "settings")
    for key, value in update_data.items():
        setattr(project, key, value)
    await db.flush()
    return _project_to_response(project)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project, _role = await resolve_project_access(project_id, user, db, min_role="admin")
    project.soft_delete()
    await db.flush()


@router.post("/{project_id}/clone", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def clone_project(
    project_id: str,
    data: ProjectCloneRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    source, _role = await resolve_project_access(project_id, user, db, min_role="viewer")

    if data.target_owner_type == "team":
        await require_team_member(data.target_owner_id, user, db, min_role="member")
    elif data.target_owner_type == "personal":
        if data.target_owner_id != user.id:
            raise HTTPException(status_code=403, detail="Cannot clone to another user's personal space")

    new_project = Project(
        id=str(uuid.uuid4()),
        name=f"{source.name} (Copy)",
        description=source.description,
        owner_type=data.target_owner_type,
        owner_id=data.target_owner_id,
        created_by=user.id,
        global_style=source.global_style,
        aspect_ratio=source.aspect_ratio,
        settings=source.settings,
    )
    db.add(new_project)
    await db.flush()

    canvas_result = await db.execute(
        select(Canvas)
        .where(Canvas.project_id == project_id, Canvas.is_deleted == False)  # noqa: E712
        .options(selectinload(Canvas.nodes), selectinload(Canvas.edges))
    )
    canvases = canvas_result.scalars().all()

    for canvas in canvases:
        new_canvas_id = str(uuid.uuid4())
        node_id_map: dict[str, str] = {}

        new_canvas = Canvas(
            id=new_canvas_id,
            project_id=new_project.id,
            source_type=canvas.source_type,
            source_id=canvas.source_id,
            name=canvas.name,
            viewport=canvas.viewport,
            is_active=canvas.is_active,
        )
        db.add(new_canvas)

        for node in canvas.nodes:
            new_node_id = str(uuid.uuid4())
            node_id_map[node.id] = new_node_id
            db.add(CanvasNode(
                id=new_node_id,
                canvas_id=new_canvas_id,
                node_type=node.node_type,
                position_x=node.position_x,
                position_y=node.position_y,
                width=node.width,
                height=node.height,
                config=node.config,
                status="idle",
                sort_order=node.sort_order,
            ))

        for edge in canvas.edges:
            new_src = node_id_map.get(edge.source_node_id)
            new_tgt = node_id_map.get(edge.target_node_id)
            if new_src and new_tgt:
                db.add(CanvasEdge(
                    id=str(uuid.uuid4()),
                    canvas_id=new_canvas_id,
                    source_node_id=new_src,
                    target_node_id=new_tgt,
                    source_handle=edge.source_handle,
                    target_handle=edge.target_handle,
                ))

    await db.flush()
    return _project_to_response(new_project)
