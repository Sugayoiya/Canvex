"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useReactFlow,
  ReactFlowProvider,
  type Connection,
  type Node,
  type Edge,
  type EdgeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { canvasApi } from "@/lib/api";
import { useCanvasStore } from "@/stores/canvas-store";
import { isValidConnection } from "@/lib/connection-rules";
import { CanvasToolbar } from "./canvas-toolbar";
import { nodeTypes } from "./nodes";

/* ------------------------------------------------------------------ */
/*  Backend data → ReactFlow node/edge mappers                        */
/* ------------------------------------------------------------------ */

interface BackendNode {
  id: string;
  node_type: string;
  position_x: number;
  position_y: number;
  config?: Record<string, unknown>;
  status?: string;
  result_text?: string;
  result_url?: string;
  error_message?: string;
}

interface BackendEdge {
  id: string;
  source_node_id: string;
  target_node_id: string;
  source_handle?: string;
  target_handle?: string;
}

interface CanvasDetail {
  id: string;
  project_id: string;
  name?: string;
  nodes?: BackendNode[];
  edges?: BackendEdge[];
}

const NODE_LABELS: Record<string, string> = {
  text: "文本",
  image: "图片",
  video: "视频",
  audio: "音频",
};

function toFlowNode(n: BackendNode): Node {
  const config = n.config ?? {};
  return {
    id: n.id,
    type: n.node_type,
    position: { x: n.position_x, y: n.position_y },
    data: {
      label: NODE_LABELS[n.node_type] ?? n.node_type,
      nodeType: n.node_type,
      config,
      status: n.status ?? "idle",
      text: (config.text as string) ?? "",
      prompt: (config.prompt as string) ?? "",
      result_text: n.result_text ?? "",
      result_url: n.result_url ?? "",
      error_message: n.error_message ?? "",
    },
  };
}

function toFlowEdge(e: BackendEdge): Edge {
  return {
    id: e.id,
    source: e.source_node_id,
    target: e.target_node_id,
    sourceHandle: e.source_handle ?? null,
    targetHandle: e.target_handle ?? null,
  };
}

/* ------------------------------------------------------------------ */
/*  Inner workspace (must be inside ReactFlowProvider)                */
/* ------------------------------------------------------------------ */

interface InnerWorkspaceProps {
  canvasId: string;
  initialData?: CanvasDetail;
}

function InnerWorkspace({ canvasId, initialData }: InnerWorkspaceProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(
    (initialData?.nodes ?? []).map(toFlowNode),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    (initialData?.edges ?? []).map(toFlowEdge),
  );
  const { getViewport } = useReactFlow();
  const { setCanvas, setSaving } = useCanvasStore();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (initialData) {
      setCanvas(canvasId, initialData.project_id);
    }
  }, [canvasId, initialData, setCanvas]);

  const persistViewport = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const vp = getViewport();
      canvasApi.update(canvasId, { viewport: vp }).catch(() => {});
    }, 500);
  }, [canvasId, getViewport]);

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!isValidConnection(connection, nodes)) return;
      setEdges((eds) => addEdge(connection, eds));
      canvasApi
        .createEdge({
          canvas_id: canvasId,
          source_node_id: connection.source!,
          target_node_id: connection.target!,
          source_handle: connection.sourceHandle ?? undefined,
          target_handle: connection.targetHandle ?? undefined,
        })
        .catch(() => {});
    },
    [canvasId, nodes, setEdges],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes);
      for (const change of changes) {
        if (change.type === "remove") {
          canvasApi.deleteEdge(change.id).catch((err) => {
            console.warn("[canvas] edge deletion sync failed:", err);
          });
        }
      }
    },
    [onEdgesChange],
  );

  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSaving(true);
      canvasApi
        .updateNode(node.id, {
          position_x: node.position.x,
          position_y: node.position.y,
        })
        .finally(() => setSaving(false));
    },
    [setSaving],
  );

  const handleAddNode = useCallback(
    (nodeType: string) => {
      const vp = getViewport();
      const posX = (-vp.x + 400) / vp.zoom;
      const posY = (-vp.y + 300) / vp.zoom;

      setSaving(true);
      canvasApi
        .createNode({
          canvas_id: canvasId,
          node_type: nodeType,
          position_x: posX,
          position_y: posY,
        })
        .then((res) => {
          const created = res.data as BackendNode;
          setNodes((nds) => [...nds, toFlowNode(created)]);
        })
        .finally(() => setSaving(false));
    },
    [canvasId, getViewport, setNodes, setSaving],
  );

  return (
    <div className="relative h-full w-full" style={{ background: "#09090b" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onNodeDragStop={handleNodeDragStop}
        onMoveEnd={persistViewport}
        nodeTypes={nodeTypes}
        isValidConnection={(conn) => isValidConnection(conn, nodes)}
        deleteKeyCode={["Backspace", "Delete"]}
        minZoom={0.2}
        maxZoom={3}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.5}
          color="rgb(96, 96, 104)"
          style={{ backgroundColor: "#09090b" }}
        />
        <Controls className="!bg-zinc-800 !border-zinc-700 !text-zinc-200 [&>button]:!bg-zinc-800 [&>button]:!border-zinc-700 [&>button]:!text-zinc-200 [&>button:hover]:!bg-zinc-700" />
        <MiniMap
          style={{
            backgroundColor: "#18181b",
            border: "1px solid #27272a",
          }}
          maskColor="rgba(0, 0, 0, 0.6)"
          nodeColor="#3f3f46"
        />
      </ReactFlow>
      <CanvasToolbar onAddNode={handleAddNode} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Public wrapper with ReactFlowProvider                             */
/* ------------------------------------------------------------------ */

interface CanvasWorkspaceProps {
  canvasId: string;
  initialData?: CanvasDetail;
}

export function CanvasWorkspace({ canvasId, initialData }: CanvasWorkspaceProps) {
  return (
    <ReactFlowProvider>
      <InnerWorkspace canvasId={canvasId} initialData={initialData} />
    </ReactFlowProvider>
  );
}

export default CanvasWorkspace;
