"use client";
import { useEffect, useRef, useState } from "react";
import { useReactFlow, useViewport } from "@xyflow/react";
import { useNodeFocus } from "../hooks/use-node-focus";
import { AIGeneratePanel } from "./ai-generate-panel";
import { TextToolbar } from "./text-toolbar";
import { TemplateMenu } from "./template-action-panel";

const PANEL_GAPS = { "ai-generate": 12, "text-toolbar": 8, "template-menu": 12 } as const;
const PANEL_HEIGHTS = { "ai-generate": 260, "text-toolbar": 36, "template-menu": 80 } as const;

const MIN_SCALE = 0.4;
const MAX_SCALE = 1.8;

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

  const { zoom, x: vpX, y: vpY } = viewport;
  const clampedZoom = Math.min(Math.max(zoom, MIN_SCALE), MAX_SCALE);

  const nodeScreenX = node.position.x * zoom + vpX;
  const nodeScreenY = node.position.y * zoom + vpY;
  const nodeScreenW = (node.measured?.width ?? 280) * zoom;
  const nodeScreenH = (node.measured?.height ?? 200) * zoom;

  const nodeCenterX = nodeScreenX + nodeScreenW / 2;

  const gap = PANEL_GAPS[panelType] * clampedZoom;
  const panelHeight = PANEL_HEIGHTS[panelType] * clampedZoom;

  const top =
    panelDirection === "above"
      ? nodeScreenY - panelHeight - gap
      : nodeScreenY + nodeScreenH + gap;

  const transformOrigin = panelDirection === "above" ? "bottom center" : "top center";

  const translateY = visible ? "0" : (panelDirection === "above" ? "4px" : "-4px");

  return (
    <div
      ref={ref}
      className="absolute pointer-events-auto"
      style={{
        left: nodeCenterX,
        top,
        zIndex: 50,
        transform: `translateX(-50%) scale(${clampedZoom}) translateY(${translateY})`,
        transformOrigin,
        opacity: visible ? 1 : 0,
        transition: "opacity 150ms ease-out, transform 150ms ease-out",
      }}
    >
      {panelType === "ai-generate" && <AIGeneratePanel nodeId={focusedNodeId} />}
      {panelType === "text-toolbar" && <TextToolbar nodeId={focusedNodeId} />}
      {panelType === "template-menu" && <TemplateMenu nodeId={focusedNodeId} />}
    </div>
  );
}
