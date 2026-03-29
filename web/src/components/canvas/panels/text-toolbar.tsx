"use client";
import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { Copy, Trash2, Maximize2 } from "lucide-react";
import { useCanvasStore } from "@/stores/canvas-store";

interface TextToolbarProps {
  nodeId: string;
}

export function TextToolbar({ nodeId }: TextToolbarProps) {
  const { getNodes } = useReactFlow();
  const { clearFocus } = useCanvasStore();

  const getNodeText = useCallback(() => {
    const node = getNodes().find((n) => n.id === nodeId);
    if (!node) return "";
    const d = node.data as Record<string, unknown>;
    return (d.result_text as string) || (d.text as string) || "";
  }, [nodeId, getNodes]);

  const handleCopy = useCallback(async () => {
    const text = getNodeText();
    if (text) {
      await navigator.clipboard.writeText(text);
    }
  }, [getNodeText]);

  const handleClear = useCallback(() => {
    const { canvasApi } = require("@/lib/api");
    canvasApi.updateNode(nodeId, { result_text: "", config: { text: "" } }).catch(() => {});
  }, [nodeId]);

  const buttons = [
    { key: "copy", icon: Copy, label: "复制", onClick: handleCopy },
    { key: "clear", icon: Trash2, label: "清空", onClick: handleClear },
  ];

  return (
    <div
      className="flex items-center gap-1"
      style={{
        height: 36,
        padding: "4px 8px",
        background: "var(--cv4-surface-primary)",
        borderRadius: "var(--cv4-radius-toolbar)",
        border: "1px solid var(--cv4-border-default)",
        boxShadow: "var(--cv4-shadow-sm)",
      }}
    >
      {buttons.map(({ key, icon: Icon, label, onClick }) => (
        <button
          key={key}
          onClick={onClick}
          className="flex items-center gap-1 cursor-pointer shrink-0"
          title={label}
          style={{
            padding: "4px 8px",
            borderRadius: 6,
            background: "transparent",
            transition: "background 100ms",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--cv4-hover-highlight)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          <Icon size={14} style={{ color: "var(--cv4-text-secondary)" }} />
          <span style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 11, color: "var(--cv4-text-secondary)" }}>
            {label}
          </span>
        </button>
      ))}
    </div>
  );
}
