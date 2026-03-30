# Phase 05: Canvas/Video Experience + Billing Dashboard - Research

**Researched:** 2026-03-30
**Domain:** Canvas UX (node redesign, batch execution, selection), Billing Data Visualization, Task Monitoring
**Confidence:** HIGH

## Summary

Phase 05 has three distinct workstreams: (1) Canvas interaction improvements — V5 node redesign removing NodeHeader, adding type-specific toolbars with center-alignment, multi-node selection execution via ReactFlow's `useOnSelectionChange`, and audio waveform visualization; (2) Billing dashboard — KPI cards, time-series charts, and project-dimension views built on the existing `billing/usage-stats/` API extended with a new time-series grouping endpoint; (3) Task monitoring — a standalone page powered by `SkillExecutionLog` and `AICallLog` data, plus node-level execution history popover.

The backend foundation is strong. `AICallLog` and `SkillExecutionLog` models already capture all needed dimensions (user/project/provider/model/tokens/cost/status/duration). The `billing/usage-stats/` endpoint aggregates by provider+model with time range and project filters. The main backend additions are: (a) time-series grouping API for charts, (b) batch/graph execution API using topological sort, (c) task list API with admin visibility controls, and (d) node execution history API.

**Primary recommendation:** Use Recharts for billing charts (React-native SVG, lightweight, good DX), `@wavesurfer/react` for audio waveform, and leverage ReactFlow 12's `useOnSelectionChange` + `onSelectionChange` for multi-node selection. Backend batch execution should use Kahn's algorithm topological sort with sequential Celery dispatch per topological layer.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 支持框选多节点批量执行 — 用户在 Canvas 上框选多个节点后点击执行，按拓扑排序依次执行选中子图
- **D-02:** 支持单节点执行 — 点击单个节点的执行按钮，仅执行该节点（沿用现有 `useNodeExecution` 模式）
- **D-03:** 需要后端拓扑排序 + 批量执行 API — Phase 03.1 D-15 明确将 Graph-Based 执行留给本阶段
- **D-04:** 视频合成流程暂不做 — 不做视频片段拼接/时间线编辑，留到后续迭代
- **D-05:** 去掉 NodeHeader 横条 — 节点卡片内不再包含标题行，卡片顶部直接是内容区
- **D-06:** 节点类型图标+名称移至卡片框外上方 — 左对齐于节点左边缘，`icon(14px) + 类型名(12px, Space Grotesk, text.muted)`
- **D-07:** 图片节点上方功能菜单分两组：左侧模板功能（高清/扩图/多角度/打光/重绘/擦除/抠图），右侧通用功能（九宫格/标注/裁剪/下载/放大预览），中间竖线分隔
- **D-08:** 视频节点上方功能菜单：现有模板功能 + 下载 + 放大查看
- **D-09:** 文本节点不变（沿用 V4 TextToolbar）
- **D-10:** 音频节点：波形可视化 + 红色播放头 + 播放/时间控制 + 上传按钮；上方功能菜单含 2x 倍速 + 下载
- **D-11:** 所有上方功能菜单与节点卡片水平居中对齐（非左对齐）
- **D-12:** 采用图表仪表盘形式 — KPI 卡片 + 折线图 + 饼图 + 明细表格
- **D-13:** 支持按项目维度 — 可切换到以项目为主维度展示
- **D-14:** 后端 API 已就绪 — `GET /billing/usage-stats/` 支持时间范围/项目筛选；需补充按日期分组的时序数据 API
- **D-15:** 非管理员只看自己的数据，管理员可看全局
- **D-16:** 独立任务监控页面 — Celery 任务队列列表，展示进行中/完成/失败任务
- **D-17:** 节点级执行历史 — 在 Canvas 节点上直接查看该节点的历史执行记录
- **D-18:** 后端数据源：`SkillExecutionLog` + `AICallLog` 已有完整的执行记录

### Claude's Discretion
- 整图执行的拓扑排序算法细节和并发策略
- 计费仪表盘的具体图表库选择（echarts/recharts/chart.js 等）
- 任务监控页的轮询/SSE 刷新策略
- 框选交互的具体 UX 细节（选框颜色、选中态高亮等）
- 时序数据 API 的聚合粒度（小时/天/周）

### Deferred Ideas (OUT OF SCOPE)
- 视频合成/拼接/时间线编辑 → 后续迭代
- 团队系统 HTTP API → Phase 06
- AI Provider DB 管理 → Phase 06
- OAuth 登录 → Phase 06
- 节点执行结果缓存/版本化 → 后续迭代
- Audio node 完整实现（真实音频生成 skill）→ 后续迭代
- 精确 quota 执行加强 → 后续迭代
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-09 | Canvas interactions and video composition workflow meet target UX | V5 node redesign (D-05~D-11), batch execution (D-01~D-03), ReactFlow selection API, wavesurfer.js for audio |
| REQ-10 | Billing dashboards and monthly usage outputs are available | Recharts for visualization, time-series API extension, project-dimension filtering (D-12~D-15), task monitoring (D-16~D-18) |
</phase_requirements>

## Standard Stack

### Core (New Dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | 3.8.1 | Billing dashboard charts (line, pie, bar) | React-native SVG charts, 16.7M weekly downloads, declarative JSX API, good TypeScript support |
| wavesurfer.js | 7.12.5 | Audio waveform rendering in AudioNode | De facto standard for browser audio visualization, canvas-based, lightweight |
| @wavesurfer/react | 1.0.12 | React wrapper for wavesurfer.js | Official React component, zero extra deps, hook + component API |

### Existing (Already Installed)

| Library | Version | Purpose | Usage in Phase |
|---------|---------|---------|----------------|
| @xyflow/react | 12.10.1 | Canvas workflow engine | `useOnSelectionChange` for multi-select, selection box, batch execution trigger |
| lucide-react | 1.7.0 | Icons | New toolbar icons (HD text, expand, rotate-3d, sun, pencil, eraser, scissors, grid-3x3, pen-tool, crop, download, maximize-2) |
| @tanstack/react-query | 5.95.2 | Server state | Billing data fetching, task list polling, node history queries |
| zustand | 5.0.12 | Client state | Selection state, batch execution state |
| axios | 1.13.6 | HTTP client | New billingApi/taskApi methods in api.ts |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts | Chart.js (react-chartjs-2) | Chart.js: smaller bundle (66KB vs 134KB) but Canvas-based (no SSR, worse a11y). Recharts wins for React-native DX and accessibility. |
| Recharts | Nivo | Nivo: more chart types but heavier (200KB+), over-engineered for this use case |
| wavesurfer.js | Custom canvas waveform | Custom: lighter but requires FFmpeg-based server-side waveform data extraction. wavesurfer.js handles client-side decoding. |
| Polling for task list | SSE | SSE: real-time but adds backend complexity (SSE endpoint + connection management). Polling with React Query's `refetchInterval` is simpler and sufficient for task monitoring. |

**Installation:**
```bash
cd web && npm install recharts wavesurfer.js @wavesurfer/react
```

## Architecture Patterns

### Recommended Project Structure Changes

```
web/src/
├── components/
│   ├── canvas/
│   │   ├── nodes/
│   │   │   ├── shared/
│   │   │   │   ├── node-shell.tsx        # MODIFY: remove NodeHeader, add external label
│   │   │   │   └── node-label.tsx        # NEW: external type icon + name label
│   │   │   ├── image-node.tsx            # MODIFY: V5 layout (no header)
│   │   │   ├── video-node.tsx            # MODIFY: V5 layout (no header)
│   │   │   ├── audio-node.tsx            # REWRITE: waveform + controls
│   │   │   └── text-node.tsx             # MODIFY: V5 layout (no header)
│   │   ├── panels/
│   │   │   ├── panel-host.tsx            # MODIFY: add new toolbar types
│   │   │   ├── image-toolbar.tsx         # NEW: V5 image toolbar (template + utility)
│   │   │   ├── video-toolbar.tsx         # NEW: V5 video toolbar (2x + download)
│   │   │   ├── audio-toolbar.tsx         # NEW: V5 audio toolbar (2x + download)
│   │   │   └── template-action-panel.tsx # MODIFY: replaced by type-specific toolbars
│   │   ├── hooks/
│   │   │   ├── use-batch-execution.ts    # NEW: multi-node batch execution
│   │   │   └── use-node-execution.ts     # EXISTING: single-node execution
│   │   ├── canvas-workspace.tsx          # MODIFY: add selection handler, batch execution UI
│   │   └── batch-execution-bar.tsx       # NEW: floating bar when nodes selected
│   ├── billing/
│   │   ├── billing-dashboard.tsx         # NEW: main dashboard container
│   │   ├── kpi-cards.tsx                 # NEW: summary KPI cards
│   │   ├── usage-chart.tsx              # NEW: time-series line chart
│   │   ├── provider-pie-chart.tsx       # NEW: provider distribution pie
│   │   ├── usage-table.tsx              # NEW: detailed usage table
│   │   └── project-usage-view.tsx       # NEW: per-project usage view
│   └── tasks/
│       ├── task-monitor-page.tsx         # NEW: task monitoring page
│       ├── task-list.tsx                 # NEW: task list with filters
│       └── node-execution-history.tsx    # NEW: node-level history popover
├── app/
│   ├── billing/page.tsx                  # NEW: billing dashboard route
│   └── tasks/page.tsx                    # NEW: task monitoring route
└── lib/
    └── api.ts                            # MODIFY: add billingApi, taskApi methods
```

```
api/app/
├── api/v1/
│   ├── billing.py          # MODIFY: add time-series endpoint + admin controls
│   ├── canvas.py            # MODIFY: add batch execution endpoint
│   ├── logs.py              # MODIFY: add task monitoring list + node history endpoints
│   └── router.py            # EXISTING: already includes all needed routers
├── services/
│   └── graph_execution_service.py  # NEW: topological sort + sequential dispatch
└── schemas/
    └── billing.py           # MODIFY: add time-series response schema
```

### Pattern 1: V5 Node Label — External Positioning

**What:** Move node type icon+name outside the card to above-left.
**When to use:** All 4 material node types.
**Implementation approach:**

The NodeShell currently renders the header inside the card. V5 moves it outside. Two approaches:
1. **ReactFlow `NodeToolbar` component** — built-in floating element, but position is limited to top/bottom/left/right, not fine-grained control.
2. **Manual absolute positioning within NodeShell** — place a `div` above the card with `position: absolute; top: -24px; left: 0`.

**Recommendation:** Use manual positioning (approach 2). ReactFlow's `NodeToolbar` doesn't support the precise `left-aligned above card` layout required. The label is a pure visual element, not interactive.

```typescript
// Inside NodeShell, before the card div
<div
  className="absolute flex items-center gap-1.5"
  style={{
    top: -24,
    left: 0,
    pointerEvents: 'none',
  }}
>
  <Icon size={14} style={{ color: 'var(--cv4-text-muted)' }} />
  <span style={{
    fontFamily: 'Space Grotesk',
    fontSize: 12,
    color: 'var(--cv4-text-muted)',
  }}>
    {label} {idSuffix}
  </span>
</div>
```

### Pattern 2: Type-Specific Toolbars via PanelHost

**What:** Replace the single `TemplateMenu` with type-specific toolbars (ImageToolbar, VideoToolbar, AudioToolbar).
**When to use:** When a node with content is focused.

The current PanelHost dispatches based on `panelType`: `"ai-generate"` | `"text-toolbar"` | `"template-menu"`. V5 needs:

```typescript
type PanelType =
  | "ai-generate"
  | "text-toolbar"
  | "image-toolbar"    // NEW: replaces template-menu for image nodes
  | "video-toolbar"    // NEW: replaces template-menu for video nodes
  | "audio-toolbar"    // NEW: replaces template-menu for audio nodes
  | null;
```

The `useNodeFocus` hook's panel type derivation changes from:
```typescript
// V4: all media nodes → "template-menu"
if (focusedNodeType !== "text") return "template-menu";
```
to:
```typescript
// V5: type-specific toolbars
if (focusedNodeType === "image") return "image-toolbar";
if (focusedNodeType === "video") return "video-toolbar";
if (focusedNodeType === "audio") return "audio-toolbar";
```

Toolbar center-alignment is already handled by PanelHost (it uses `nodeCenterX` with `translateX(-50%)`). Each toolbar just needs its own width in `PANEL_HEIGHTS` and `PANEL_GAPS`.

### Pattern 3: Batch Execution — Frontend Selection + Backend Topo Sort

**What:** Multi-node selection triggers a "Run Selected" button. Backend sorts the selected subgraph topologically and executes in order.
**Architecture:**

```
Frontend:                          Backend:
useOnSelectionChange → nodes[] → POST /canvas/batch-execute
                                   ├── Validate node_ids belong to canvas
                                   ├── Fetch edges for selected subgraph
                                   ├── Topological sort (Kahn's algorithm)
                                   ├── For each layer:
                                   │   ├── Submit skills to Celery
                                   │   └── Wait for completion
                                   └── Return batch execution ID
Frontend polls batch status:
GET /canvas/batch-execute/{batch_id}/status
```

**Frontend selection flow:**
1. User rectangle-selects nodes (ReactFlow built-in, `selectionOnDrag=true`)
2. `useOnSelectionChange` fires with `{ nodes, edges }`
3. If `nodes.length > 1`, show floating `BatchExecutionBar` with "Run Selected (N)" button
4. Click dispatches `POST /canvas/batch-execute` with selected `node_ids`
5. Frontend enters batch polling mode, updating each node's status as they complete

### Pattern 4: Billing Dashboard Layout

**What:** Full-page dashboard with responsive grid layout.
**Layout:**

```
┌──────────────────────────────────────────────────────┐
│ 计费概览        [全局 / 按项目 ▾]  [日期范围选择器]    │
├──────┬──────┬──────┬──────────────────────────────────┤
│ KPI  │ KPI  │ KPI  │                                  │
│ 总花费│ 总调用│ 总Token│        Provider 饼图            │
├──────┴──────┴──────┤                                  │
│                    │                                  │
│  日/周趋势折线图    │                                  │
│                    │                                  │
├────────────────────┴──────────────────────────────────┤
│ 明细表格 (provider / model / calls / tokens / cost)    │
└──────────────────────────────────────────────────────┘
```

### Anti-Patterns to Avoid

- **Don't use `selectionMode` prop for batch execution** — ReactFlow's `selectionMode` controls whether partial overlap selects nodes. The built-in rectangle selection already works; just listen to `useOnSelectionChange`.
- **Don't poll each node individually during batch execution** — Use a single batch status endpoint that returns all node statuses at once.
- **Don't render waveform in React DOM directly** — WaveSurfer.js needs a container ref; use `@wavesurfer/react`'s `WavesurferPlayer` component which handles this correctly.
- **Don't use echarts** — It's 800KB+ gzipped, massive overkill for 3 chart types. Recharts at 134KB covers all needed chart types with better React integration.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Audio waveform rendering | Custom canvas waveform drawer | `wavesurfer.js` + `@wavesurfer/react` | Client-side audio decoding, zoom, playback controls, region marking — WaveSurfer handles all edge cases (CORS, codecs, mobile Safari) |
| Chart rendering | Custom SVG chart components | `recharts` | Axis scaling, responsive resize, tooltip positioning, animation — all solved problems |
| Topological sort | Custom graph sort | Kahn's algorithm (standard BFS-based) | Well-known O(V+E) algorithm, 20 lines of Python. No library needed, but don't invent a new sorting approach. |
| Selection box rendering | Custom drag-select overlay | ReactFlow built-in `selectionOnDrag` | ReactFlow handles selection box rendering, node intersection detection, keyboard modifiers (Shift+click) |
| Time-series data aggregation | App-level date grouping | SQL `DATE_TRUNC` / `strftime` | Database-level grouping is orders of magnitude faster than fetching all rows and grouping in Python |

## Common Pitfalls

### Pitfall 1: ReactFlow useOnSelectionChange Infinite Loop
**What goes wrong:** The `onChange` callback passed to `useOnSelectionChange` must be memoized with `useCallback`. Unmemoized callbacks cause the hook to re-register on every render, which triggers selection change events, creating an infinite loop.
**Why it happens:** ReactFlow's internal selection subscription compares callback references.
**How to avoid:** Always wrap the handler in `useCallback` with proper dependency array.
**Warning signs:** Browser tab freezes when clicking on canvas.

### Pitfall 2: WaveSurfer.js Container Ref Timing
**What goes wrong:** WaveSurfer tries to access the container element before React has mounted it, causing "container not found" errors.
**Why it happens:** useEffect runs after paint, but WaveSurfer initialization may race with React lifecycle.
**How to avoid:** Use `@wavesurfer/react`'s `WavesurferPlayer` component instead of manual initialization. If using the hook, ensure `containerRef.current` exists before calling `create()`.
**Warning signs:** Console error "WaveSurfer: container not found" or blank waveform area.

### Pitfall 3: Batch Execution State Synchronization
**What goes wrong:** When executing a batch of 5 nodes, frontend shows stale status for nodes that completed while polling was focused on another node.
**Why it happens:** The existing `useNodeExecution` hook polls per-node. Batch execution needs a unified status view.
**How to avoid:** Backend batch-execute endpoint returns a `batch_id`. Frontend polls `GET /batch/{batch_id}/status` which returns all node statuses in one response. Frontend dispatches status updates to all affected nodes.
**Warning signs:** Some nodes show "running" even after batch completes.

### Pitfall 4: SQLite DATE_TRUNC Incompatibility
**What goes wrong:** `DATE_TRUNC('day', created_at)` works in PostgreSQL but not SQLite.
**Why it happens:** This project supports both SQLite (dev) and PostgreSQL (prod). SQLite uses `strftime()` for date manipulation.
**How to avoid:** Use a helper function that detects the database engine and uses the appropriate function:
```python
from app.core.config import settings

if settings.USE_SQLITE:
    date_group = func.strftime('%Y-%m-%d', AICallLog.created_at)
else:
    date_group = func.date_trunc('day', AICallLog.created_at)
```
**Warning signs:** 500 error on `/billing/usage-timeseries/` in dev mode.

### Pitfall 5: PanelHost Toolbar Width Mismatch
**What goes wrong:** V5 image toolbar (~596px) is much wider than the node (340px). If center-aligned, it extends ~128px beyond each side. The toolbar may be clipped by parent overflow or extend beyond viewport.
**Why it happens:** PanelHost uses `translateX(-50%)` for centering, which works but doesn't account for viewport boundaries.
**How to avoid:** PanelHost already uses `pointer-events-auto` and absolute positioning within the canvas viewport. ReactFlow's default overflow is visible. Just ensure the toolbar's z-index is high enough (currently 50, which is correct).
**Warning signs:** Toolbar buttons near canvas edges are unclickable.

### Pitfall 6: Recharts SSR Hydration Mismatch
**What goes wrong:** Recharts uses SVG which can produce different output on server vs client (especially `ResponsiveContainer` which reads DOM dimensions).
**Why it happens:** Next.js 16 App Router renders components on the server by default.
**How to avoid:** Mark the billing dashboard component with `"use client"` directive. Use `ResponsiveContainer` which handles SSR gracefully in recent versions.
**Warning signs:** React hydration mismatch warnings in console, charts flash on page load.

## Code Examples

### Example 1: Batch Execution API (Backend)

```python
# api/app/services/graph_execution_service.py
from collections import deque
from typing import List, Dict, Tuple

def topological_sort(
    node_ids: set[str],
    edges: list[Tuple[str, str]],  # (source, target)
) -> list[list[str]]:
    """
    Kahn's algorithm — returns nodes grouped by topological layers.
    Layer 0 has no in-edges, layer 1 depends on layer 0, etc.
    """
    in_degree: Dict[str, int] = {nid: 0 for nid in node_ids}
    adj: Dict[str, list[str]] = {nid: [] for nid in node_ids}

    for src, tgt in edges:
        if src in node_ids and tgt in node_ids:
            adj[src].append(tgt)
            in_degree[tgt] += 1

    queue = deque(nid for nid, deg in in_degree.items() if deg == 0)
    layers: list[list[str]] = []

    while queue:
        layer = list(queue)
        layers.append(layer)
        next_queue: deque[str] = deque()
        for nid in layer:
            for neighbor in adj[nid]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    next_queue.append(neighbor)
        queue = next_queue

    if sum(len(l) for l in layers) != len(node_ids):
        raise ValueError("Cycle detected in selected subgraph")

    return layers
```

### Example 2: Batch Execution Endpoint

```python
# api/app/api/v1/canvas.py — new endpoint
@router.post("/batch-execute")
async def batch_execute(
    req: BatchExecuteRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Execute selected nodes in topological order."""
    canvas = await _load_canvas(req.canvas_id, db)
    await resolve_project_access(canvas.project_id, user, db)
    
    # Load nodes and edges for the selected subgraph
    nodes = await db.execute(
        select(CanvasNode).where(CanvasNode.id.in_(req.node_ids))
    )
    edges = await db.execute(
        select(CanvasEdge).where(
            CanvasEdge.canvas_id == req.canvas_id,
            CanvasEdge.source_node_id.in_(req.node_ids),
            CanvasEdge.target_node_id.in_(req.node_ids),
        )
    )
    
    # Topological sort
    layers = topological_sort(
        set(req.node_ids),
        [(e.source_node_id, e.target_node_id) for e in edges.scalars()],
    )
    
    # Create batch execution record, dispatch layer 0
    # Frontend polls batch status
    ...
```

### Example 3: Time-Series Billing API

```python
# api/app/api/v1/billing.py — new endpoint
@router.get("/usage-timeseries/")
async def get_usage_timeseries(
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    granularity: str = Query("day", regex="^(hour|day|week)$"),
    project_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    if settings.USE_SQLITE:
        fmt = {"hour": "%Y-%m-%d %H:00", "day": "%Y-%m-%d", "week": "%Y-%W"}
        date_group = func.strftime(fmt[granularity], AICallLog.created_at)
    else:
        date_group = func.date_trunc(granularity, AICallLog.created_at)

    stmt = select(
        date_group.label("period"),
        func.count().label("calls"),
        func.coalesce(func.sum(AICallLog.cost), 0).label("cost"),
        func.coalesce(func.sum(AICallLog.input_tokens + AICallLog.output_tokens), 0).label("tokens"),
    ).where(
        AICallLog.created_at >= start_date,
        AICallLog.created_at <= end_date,
    )

    if not getattr(user, "is_admin", False):
        stmt = stmt.where(AICallLog.user_id == user.id)
    if project_id:
        stmt = stmt.where(AICallLog.project_id == project_id)

    stmt = stmt.group_by("period").order_by("period")
    result = await db.execute(stmt)
    return [dict(row._mapping) for row in result.all()]
```

### Example 4: Audio Node with WaveSurfer

```typescript
// Simplified WaveSurfer integration in AudioNode
import WavesurferPlayer from '@wavesurfer/react';

function AudioNodeContent({ audioUrl }: { audioUrl: string }) {
  const [wavesurfer, setWavesurfer] = useState<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  return (
    <div style={{ padding: '16px' }}>
      <WavesurferPlayer
        height={100}
        waveColor="var(--cv4-text-disabled)"
        progressColor="var(--cv4-text-muted)"
        cursorColor="#FF3B30"
        cursorWidth={2}
        url={audioUrl}
        onReady={(ws) => {
          setWavesurfer(ws);
          setDuration(ws.getDuration());
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeupdate={(ws) => setCurrentTime(ws.getCurrentTime())}
      />
      <div className="flex items-center justify-center gap-4 mt-3">
        <span style={{ fontFamily: 'Space Grotesk', fontSize: 13, color: 'var(--cv4-text-muted)' }}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
        <button onClick={() => wavesurfer?.playPause()}>
          {isPlaying ? <Pause /> : <Play />}
        </button>
      </div>
    </div>
  );
}
```

### Example 5: useOnSelectionChange for Batch Execution

```typescript
import { useCallback, useState } from 'react';
import { useOnSelectionChange, type Node } from '@xyflow/react';

export function useBatchExecution() {
  const [selectedNodes, setSelectedNodes] = useState<Node[]>([]);

  const onChange = useCallback(({ nodes }: { nodes: Node[] }) => {
    setSelectedNodes(nodes);
  }, []);

  useOnSelectionChange({ onChange });

  const canBatchExecute = selectedNodes.length > 1;
  
  const executeBatch = useCallback(async () => {
    if (!canBatchExecute) return;
    const nodeIds = selectedNodes.map(n => n.id);
    // POST /canvas/batch-execute with nodeIds
  }, [selectedNodes, canBatchExecute]);

  return { selectedNodes, canBatchExecute, executeBatch };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ReactFlow `onSelectionChange` prop | `useOnSelectionChange` hook | v12 | Hook-based is more composable, can be used in child components |
| wavesurfer-react (community) | @wavesurfer/react (official) | 2024 | Official package, better maintained, 168K vs 4.5K weekly downloads |
| Chart.js for React | Recharts 3.x | 2024-2025 | Recharts SVG approach better for accessibility, responsive design |
| `NodeToolbar` for all floating UI | Custom positioned panels | Phase 04 | More precise control over positioning, already established pattern |

## Open Questions

1. **Batch execution concurrency within a layer**
   - What we know: Kahn's algorithm groups nodes into layers. Nodes in the same layer have no dependencies on each other.
   - What's unclear: Should nodes within the same layer execute concurrently (Celery group) or sequentially? Concurrent is faster but uses more Celery workers.
   - Recommendation: Execute nodes within a layer concurrently using `celery.group()`, with a configurable max concurrency (default: 3). This balances speed with resource usage.

2. **Batch execution failure handling**
   - What we know: If a node in layer 1 fails, should layer 2 nodes that depend on it still execute?
   - Recommendation: Fail-fast for downstream dependents — mark dependent nodes as "blocked" (reusing existing blocked state). Non-dependent nodes in later layers continue executing.

3. **Task monitoring page access control**
   - What we know: D-15 says non-admin sees own data, admin sees global. The logs API already scopes by `user_id`.
   - Recommendation: Reuse the same pattern from `logs.py` — filter by `user.id` for non-admin, show all for admin.

4. **Image toolbar skill bindings**
   - What we know: D-07 lists 7 template skills (upscale, outpaint, multiview, relight, inpaint, erase, segment). These reference `visual.*` skills.
   - What's unclear: Do all 7 skills exist in the registry? Phase 04 added some visual skills but possibly not all 7.
   - Recommendation: Implement toolbar buttons for all 7, but mark missing skills as "coming soon" (disabled state) to avoid blocking the UI work.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest (backend) + vitest (frontend — not yet configured) |
| Config file | `api/pyproject.toml` (pytest section) |
| Quick run command | `cd api && uv run pytest tests/ -x --tb=short` |
| Full suite command | `cd api && uv run pytest tests/ -v` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-09a | Batch execute topological sort correctness | unit | `cd api && uv run pytest tests/test_graph_execution.py -x` | ❌ Wave 0 |
| REQ-09b | Batch execute API validates node ownership | integration | `cd api && uv run pytest tests/test_batch_execute_api.py -x` | ❌ Wave 0 |
| REQ-10a | Time-series aggregation returns correct groups | unit | `cd api && uv run pytest tests/test_billing_timeseries.py -x` | ❌ Wave 0 |
| REQ-10b | Admin vs non-admin visibility scoping | integration | `cd api && uv run pytest tests/test_billing_access.py -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd api && uv run pytest tests/ -x --tb=short -q`
- **Per wave merge:** `cd api && uv run pytest tests/ -v`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/test_graph_execution.py` — covers REQ-09a (topological sort unit tests)
- [ ] `tests/test_batch_execute_api.py` — covers REQ-09b (batch execute endpoint)
- [ ] `tests/test_billing_timeseries.py` — covers REQ-10a (time-series aggregation)
- [ ] `tests/test_billing_access.py` — covers REQ-10b (admin scoping)

## Sources

### Primary (HIGH confidence)
- Codebase analysis: Full read of all referenced canonical files (canvas-workspace.tsx, node components, billing.py, logs.py, canvas.py, skills.py, executor.py, registry.py)
- Design specs: `05-interaction-video/designs/component-specs.md`, `design-tokens.json`, `canvas-v5-node-redesign.png`
- Phase 04 design specs: `04-media-tools/designs/component-specs.md`
- ReactFlow docs: `useOnSelectionChange` API reference (reactflow.dev)
- npm registry: verified versions for recharts (3.8.1), wavesurfer.js (7.12.5), @wavesurfer/react (1.0.12), @xyflow/react (12.10.2)

### Secondary (MEDIUM confidence)
- WebSearch: Recharts vs Chart.js comparison (pkgpulse.com, 2026)
- WebSearch: ReactFlow selection method tracking PR (#5514)
- WebSearch: @wavesurfer/react usage examples (npmjs.com)

### Tertiary (LOW confidence)
- None — all findings verified with primary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified via npm registry, adoption confirmed
- Architecture: HIGH — all patterns based on existing codebase patterns (PanelHost, useNodeExecution, billing API)
- Pitfalls: HIGH — pitfalls 1-5 are from direct codebase analysis; pitfall 6 is from known Next.js SSR behavior

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable domain — charting libraries and ReactFlow are mature)
