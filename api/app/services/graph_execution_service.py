from collections import defaultdict

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.batch_execution import BatchExecution
from app.models.canvas import CanvasNode, CanvasEdge


VALID_BATCH_STATUSES = {"queued", "running", "completed", "failed", "blocked", "timeout"}
TERMINAL_STATUSES = {"completed", "failed", "blocked", "timeout"}


def topological_sort(
    node_ids: set[str], edges: list[tuple[str, str]]
) -> list[list[str]]:
    """Kahn's algorithm BFS producing execution layers.

    - Orphan nodes (no edges at all in subgraph) → layer 0
    - Each layer is sorted by node_id for deterministic ordering
    - Raises ValueError with offending node IDs on cycle detection
    """
    in_degree: dict[str, int] = {nid: 0 for nid in node_ids}
    out_degree: dict[str, int] = {nid: 0 for nid in node_ids}
    adj: dict[str, list[str]] = defaultdict(list)

    for src, tgt in edges:
        if src in node_ids and tgt in node_ids:
            in_degree[tgt] += 1
            out_degree[src] += 1
            adj[src].append(tgt)

    orphans = sorted(
        nid for nid in node_ids
        if in_degree[nid] == 0 and out_degree[nid] == 0
    )
    non_orphan_seeds = sorted(
        nid for nid in node_ids
        if in_degree[nid] == 0 and out_degree[nid] > 0
    )

    if orphans and not non_orphan_seeds and not edges:
        return [orphans]

    layers: list[list[str]] = []
    if orphans:
        layers.append(orphans)

    queue = list(non_orphan_seeds)
    processed = set(orphans)

    while queue:
        layer = sorted(queue)
        layers.append(layer)
        processed.update(layer)
        next_queue: list[str] = []
        for nid in layer:
            for neighbor in adj[nid]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    next_queue.append(neighbor)
        queue = next_queue

    if len(processed) != len(node_ids):
        remaining = sorted(node_ids - processed)
        raise ValueError(f"Cycle detected among nodes: {remaining}")

    return layers


class BatchExecutionService:
    def __init__(self, db: AsyncSession, user):
        self.db = db
        self.user = user

    async def start_batch(
        self, canvas_id: str, node_ids: list[str]
    ) -> BatchExecution:
        result = await self.db.execute(
            select(CanvasNode).where(
                CanvasNode.id.in_(node_ids),
                CanvasNode.canvas_id == canvas_id,
            )
        )
        found = {n.id for n in result.scalars().all()}
        missing = set(node_ids) - found
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Nodes not found in canvas: {sorted(missing)}",
            )

        edge_result = await self.db.execute(
            select(CanvasEdge).where(
                CanvasEdge.canvas_id == canvas_id,
                CanvasEdge.source_node_id.in_(node_ids),
                CanvasEdge.target_node_id.in_(node_ids),
            )
        )
        edge_tuples = [
            (e.source_node_id, e.target_node_id)
            for e in edge_result.scalars().all()
        ]

        try:
            layers = topological_sort(set(node_ids), edge_tuples)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

        batch = BatchExecution(
            canvas_id=canvas_id,
            user_id=self.user.id,
            layers=layers,
            node_statuses={nid: "queued" for nid in node_ids},
            current_layer=0,
            status="running",
            total_nodes=len(node_ids),
        )
        self.db.add(batch)
        await self.db.flush()
        await self.db.refresh(batch)
        return batch

    async def get_batch_status(self, batch_id: str) -> BatchExecution:
        result = await self.db.execute(
            select(BatchExecution).where(BatchExecution.id == batch_id)
        )
        batch = result.scalar_one_or_none()
        if batch is None:
            raise HTTPException(status_code=404, detail="Batch not found")

        if batch.user_id != self.user.id and not getattr(self.user, "is_admin", False):
            raise HTTPException(status_code=403, detail="Access denied")

        return batch

    async def update_node_status(
        self, batch_id: str, node_id: str, new_status: str
    ) -> BatchExecution:
        if new_status not in VALID_BATCH_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status. Must be one of {sorted(VALID_BATCH_STATUSES)}",
            )

        batch = await self.get_batch_status(batch_id)

        if node_id not in batch.node_statuses:
            raise HTTPException(status_code=400, detail="Node not in batch")

        current = batch.node_statuses[node_id]
        if current in TERMINAL_STATUSES:
            raise HTTPException(
                status_code=409,
                detail=f"Cannot transition from terminal status '{current}'",
            )

        updated_statuses = dict(batch.node_statuses)
        updated_statuses[node_id] = new_status
        batch.node_statuses = updated_statuses

        current_layer_nodes = (
            batch.layers[batch.current_layer]
            if batch.current_layer < len(batch.layers)
            else []
        )
        if current_layer_nodes and all(
            updated_statuses.get(nid) in TERMINAL_STATUSES
            for nid in current_layer_nodes
        ):
            if batch.current_layer + 1 < len(batch.layers):
                batch.current_layer += 1

        if all(s in TERMINAL_STATUSES for s in updated_statuses.values()):
            has_failure = any(
                s in {"failed", "blocked", "timeout"}
                for s in updated_statuses.values()
            )
            batch.status = "failed" if has_failure else "completed"

        await self.db.flush()
        await self.db.refresh(batch)
        return batch
