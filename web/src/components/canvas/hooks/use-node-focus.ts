"use client";
import { useCallback } from "react";
import { useCanvasStore } from "@/stores/canvas-store";

export type PanelType = "ai-generate" | "text-toolbar" | "image-toolbar" | "video-toolbar" | "audio-toolbar" | null;
export type PanelDirection = "above" | "below";

export interface FocusState {
  focusedNodeId: string | null;
  panelType: PanelType;
  panelDirection: PanelDirection;
}

export function useNodeFocus() {
  const { focusedNodeId, focusedNodeType, focusedNodeHasContent, setFocusedNode, clearFocus } =
    useCanvasStore();

  const panelType: PanelType = (() => {
    if (!focusedNodeId) return null;
    if (!focusedNodeHasContent) return "ai-generate";
    if (focusedNodeType === "text") return "text-toolbar";
    if (focusedNodeType === "image") return "image-toolbar";
    if (focusedNodeType === "video") return "video-toolbar";
    if (focusedNodeType === "audio") return "audio-toolbar";
    return null;
  })();

  const panelDirection: PanelDirection = focusedNodeHasContent ? "above" : "below";

  const handleNodeClick = useCallback(
    (nodeId: string, nodeType: string, hasContent: boolean) => {
      setFocusedNode(nodeId, nodeType, hasContent);
    },
    [setFocusedNode],
  );

  const handlePaneClick = useCallback(() => {
    clearFocus();
  }, [clearFocus]);

  const handleEscape = useCallback(() => {
    clearFocus();
  }, [clearFocus]);

  return {
    focusedNodeId,
    panelType,
    panelDirection,
    handleNodeClick,
    handlePaneClick,
    handleEscape,
  };
}
