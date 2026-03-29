"use client";
import { useEffect, useRef, useState } from "react";
import { useReactFlow, useViewport } from "@xyflow/react";
import { useNodeFocus } from "../hooks/use-node-focus";
import { AIGeneratePanel } from "./ai-generate-panel";
import { TextToolbar } from "./text-toolbar";
import { TemplateMenu } from "./template-action-panel";

const PANEL_GAPS = { "ai-generate": 12, "text-toolbar": 8, "template-menu": 12 } as const;
const PANEL_HEIGHTS = { "ai-generate": 260, "text-toolbar": 36, "template-menu": 80 } as const;

export function PanelHost() {
  const { focusedNodeId, panelType, panelDirection, handleEscape } = useNodeFocus();
  const { getNodes } = useReactFlow();
  const viewport = useViewport();
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleEscape();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleEscape]);

  useEffect(() => {
    if (focusedNodeId && panelType) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [focusedNodeId, panelType]);

  if (!focusedNodeId || !panelType) return null;

  const node = getNodes().find((n) => n.id === focusedNodeId);
  if (!node) return null;

  const screenX = node.position.x * viewport.zoom + viewport.x;
  const screenY = node.position.y * viewport.zoom + viewport.y;
  const nodeHeight = (node.measured?.height ?? 200) * viewport.zoom;
  const gap = PANEL_GAPS[panelType];
  const panelHeight = PANEL_HEIGHTS[panelType];

  const top =
    panelDirection === "above"
      ? screenY - panelHeight - gap
      : screenY + nodeHeight + gap;

  return (
    <div
      ref={ref}
      className="absolute pointer-events-auto"
      style={{
        left: screenX,
        top,
        zIndex: 50,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(4px)",
        transition: "opacity 150ms ease-out, transform 150ms ease-out",
      }}
    >
      {panelType === "ai-generate" && <AIGeneratePanel nodeId={focusedNodeId} />}
      {panelType === "text-toolbar" && <TextToolbar nodeId={focusedNodeId} />}
      {panelType === "template-menu" && <TemplateMenu nodeId={focusedNodeId} />}
    </div>
  );
}
