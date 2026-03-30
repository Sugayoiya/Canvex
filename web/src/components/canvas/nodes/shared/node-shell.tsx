"use client";
import { Handle, Position } from "@xyflow/react";
import { FileText, Image, PlayCircle, Music } from "lucide-react";
import { StatusIndicator, type NodeExecutionStatus } from "./status-indicator";

const NODE_ICONS = { text: FileText, image: Image, video: PlayCircle, audio: Music } as const;
const NODE_TYPE_LABELS = { text: "文本", image: "图片", video: "视频", audio: "音频" } as const;
const DEFAULT_WIDTHS = { text: 280, image: 340, video: 340, audio: 280 } as const;

export type MaterialNodeType = "text" | "image" | "video" | "audio";

export interface NodeShellProps {
  nodeId: string;
  nodeType: MaterialNodeType;
  hasContent: boolean;
  status: NodeExecutionStatus;
  isFocused?: boolean;
  children: React.ReactNode;
}

export function NodeShell({ nodeId, nodeType, hasContent, status, isFocused, children }: NodeShellProps) {
  const Icon = NODE_ICONS[nodeType];
  const label = NODE_TYPE_LABELS[nodeType];
  const width = DEFAULT_WIDTHS[nodeType];
  const idSuffix = nodeId.slice(-2);

  return (
    <div
      className="relative transition-shadow duration-[120ms]"
      style={{ width, overflow: "visible" }}
    >
      {/* V5: External label — above-left of card */}
      <div
        className="absolute flex items-center pointer-events-none"
        style={{ top: -24, left: 0, gap: 8 }}
      >
        <Icon size={14} style={{ color: "var(--cv4-text-muted)" }} />
        <span
          style={{
            fontFamily: "Space Grotesk",
            fontSize: 13,
            color: "var(--cv4-text-muted)",
            lineHeight: 1,
            whiteSpace: "nowrap",
          }}
        >
          {label} {idSuffix}
        </span>
        <StatusIndicator status={status} />
      </div>

      {/* V5: Card body — no header row inside */}
      <div
        className="node-card-body"
        style={{
          overflow: "hidden",
          background: "var(--cv4-surface-primary)",
          borderRadius: "var(--cv4-radius-node)",
          border: isFocused
            ? "1.5px solid var(--cv4-border-focused)"
            : "1px solid var(--cv4-border-default)",
          boxShadow: isFocused ? "var(--cv4-shadow-lg)" : "var(--cv4-shadow-md)",
          cursor: "grab",
        }}
      >
        {children}
      </div>

      <Handle type="target" position={Position.Left} id="input" style={{ zIndex: 10 }} />
      <Handle type="source" position={Position.Right} id="output" style={{ zIndex: 10 }} />
    </div>
  );
}
