"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { canvasApi } from "@/lib/api";
import { useCanvasStore } from "@/stores/canvas-store";
import { isValidConnection } from "@/lib/connection-rules";
import { LeftFloatingMenu } from "./canvas-floating-toolbar";
import { PanelHost } from "./panels/panel-host";
import { AssetPanel } from "./canvas-asset-panel";
import { NodeCreationMenu } from "./canvas-node-creation-menu";
import { useNodeFocus } from "./hooks/use-node-focus";
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
  const { handlePaneClick, focusedNodeId } = useNodeFocus();
  const { clearFocus } = useCanvasStore();
  const [showAssets, setShowAssets] = useState(false);
  const { screenToFlowPosition } = useReactFlow();

  const connectStartRef = useRef<{ nodeId: string; nodeType: string } | null>(null);
  const [creationMenu, setCreationMenu] = useState<{
    screenPos: { x: number; y: number };
    flowPos: { x: number; y: number };
    sourceNodeType: string;
    sourceNodeId: string;
  } | null>(null);

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

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      for (const change of changes) {
        if (change.type === "remove") {
          if (focusedNodeId === change.id) clearFocus();
          canvasApi.deleteNode(change.id).catch((err) => {
            console.warn("[canvas] node deletion sync failed:", err);
          });
        }
      }
    },
    [onNodesChange, focusedNodeId, clearFocus],
  );

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

  const handleConnectStart = useCallback(
    (_event: MouseEvent | TouchEvent, params: { nodeId: string | null; handleType: string | null }) => {
      if (!params.nodeId) return;
      const node = nodes.find((n) => n.id === params.nodeId);
      connectStartRef.current = {
        nodeId: params.nodeId,
        nodeType: node?.type ?? "text",
      };
    },
    [nodes],
  );

  const handleConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      const target = (event as MouseEvent).target as HTMLElement;
      const isDropOnPane = target?.classList?.contains("react-flow__pane");
      if (!isDropOnPane || !connectStartRef.current) {
        connectStartRef.current = null;
        return;
      }

      const clientX = (event as MouseEvent).clientX;
      const clientY = (event as MouseEvent).clientY;
      const flowPos = screenToFlowPosition({ x: clientX, y: clientY });

      setCreationMenu({
        screenPos: { x: clientX, y: clientY },
        flowPos,
        sourceNodeType: connectStartRef.current.nodeType,
        sourceNodeId: connectStartRef.current.nodeId,
      });
      connectStartRef.current = null;
    },
    [screenToFlowPosition],
  );

  const handleCreationMenuSelect = useCallback(
    (nodeType: string) => {
      if (!creationMenu) return;
      const { flowPos, sourceNodeId } = creationMenu;

      setSaving(true);
      canvasApi
        .createNode({
          canvas_id: canvasId,
          node_type: nodeType,
          position_x: flowPos.x,
          position_y: flowPos.y,
        })
        .then((res) => {
          const created = res.data as BackendNode;
          setNodes((nds) => [...nds, toFlowNode(created)]);

          const connection: Connection = {
            source: sourceNodeId,
            target: created.id,
            sourceHandle: "output",
            targetHandle: "input",
          };
          setEdges((eds) => addEdge(connection, eds));
          canvasApi
            .createEdge({
              canvas_id: canvasId,
              source_node_id: sourceNodeId,
              target_node_id: created.id,
              source_handle: "output",
              target_handle: "input",
            })
            .catch(() => {});
        })
        .finally(() => setSaving(false));

      setCreationMenu(null);
    },
    [canvasId, creationMenu, setNodes, setEdges, setSaving],
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
    <div className="relative h-full w-full" style={{ background: "var(--cv4-canvas-bg)" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onConnectStart={handleConnectStart}
        onConnectEnd={handleConnectEnd}
        onNodeDragStop={handleNodeDragStop}
        onMoveEnd={persistViewport}
        onPaneClick={(e) => { handlePaneClick(e); setCreationMenu(null); }}
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
          gap={40}
          size={2}
          color="var(--cv4-grid-dot)"
          style={{ backgroundColor: "var(--cv4-canvas-bg)" }}
        />
        <Controls className="!bg-zinc-800 !border-zinc-700 !text-zinc-200 [&>button]:!bg-zinc-800 [&>button]:!border-zinc-700 [&>button]:!text-zinc-200 [&>button:hover]:!bg-zinc-700" />
        <MiniMap
          position="bottom-left"
          style={{
            left: 60,
            bottom: 10,
            backgroundColor: "var(--cv4-surface-primary)",
            border: "1px solid var(--cv4-border-default)",
            borderRadius: 10,
          }}
          maskColor="rgba(0, 0, 0, 0.5)"
          nodeColor="var(--cv4-text-muted)"
        />
      </ReactFlow>
      <LeftFloatingMenu onAddNode={handleAddNode} onToggleAssets={() => setShowAssets(v => !v)} />
      <PanelHost />
      <AssetPanel open={showAssets} onClose={() => setShowAssets(false)} />
      {creationMenu && (
        <NodeCreationMenu
          position={creationMenu.screenPos}
          sourceNodeType={creationMenu.sourceNodeType}
          onSelect={handleCreationMenuSelect}
          onClose={() => setCreationMenu(null)}
        />
      )}
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
