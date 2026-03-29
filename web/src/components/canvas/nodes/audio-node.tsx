"use client";
import type { NodeProps } from "@xyflow/react";
import { Music } from "lucide-react";
import { NodeShell } from "./shared/node-shell";
import { useNodeFocus } from "../hooks/use-node-focus";
import { useNodeExecution } from "../hooks/use-node-execution";
import { useNodePersistence } from "../hooks/use-node-persistence";

export function AudioNode({ id, data }: NodeProps) {
  const d = data as Record<string, unknown>;
  const status = (d.status as string) || "idle";
  const hasContent = false;
  const { focusedNodeId, handleNodeClick } = useNodeFocus();

  useNodeExecution(id);
  useNodePersistence(id);

  return (
    <div onClick={() => handleNodeClick(id, "audio", hasContent)}>
      <NodeShell
        nodeId={id}
        nodeType="audio"
        hasContent={hasContent}
        status={status as "idle" | "queued" | "running" | "completed" | "failed" | "timeout" | "blocked"}
        isFocused={focusedNodeId === id}
      >
        <div
          className="flex flex-col items-center justify-center"
          style={{ height: 100, background: "var(--cv4-surface-secondary)" }}
        >
          <Music size={28} style={{ color: "var(--cv4-text-disabled)" }} />
        </div>
        <div style={{ padding: "12px 16px" }} className="flex flex-col gap-2">
          <span
            style={{ fontFamily: "Manrope, sans-serif", fontSize: 12, color: "var(--cv4-text-disabled)" }}
          >
            🎵 音频功能即将上线
          </span>
        </div>
      </NodeShell>
    </div>
  );
}
