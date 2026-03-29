"use client";
import type { NodeProps } from "@xyflow/react";
import { FileText } from "lucide-react";
import { NodeShell } from "./shared/node-shell";
import { useNodeFocus } from "../hooks/use-node-focus";
import { useNodeExecution } from "../hooks/use-node-execution";
import { useNodePersistence } from "../hooks/use-node-persistence";

export function TextNode({ id, data }: NodeProps) {
  const d = data as Record<string, unknown>;
  const text = (d.result_text as string) || (d.text as string) || "";
  const hasContent = text.length > 0;
  const status = (d.status as string) || "idle";
  const { focusedNodeId, handleNodeClick } = useNodeFocus();

  useNodeExecution(id);
  useNodePersistence(id);

  return (
    <div onClick={() => handleNodeClick(id, "text", hasContent)}>
      <NodeShell
        nodeId={id}
        nodeType="text"
        hasContent={hasContent}
        status={status as "idle" | "queued" | "running" | "completed" | "failed" | "timeout" | "blocked"}
        isFocused={focusedNodeId === id}
      >
        {hasContent ? (
          <div style={{ padding: "12px 16px" }}>
            <div className="flex gap-3">
              <div
                style={{
                  width: 3,
                  background: "var(--cv4-text-disabled)",
                  borderRadius: 2,
                  opacity: 0.6,
                  flexShrink: 0,
                }}
              />
              <div className="min-w-0 flex-1">
                <p
                  style={{
                    fontFamily: "Manrope, sans-serif",
                    fontSize: 15,
                    fontWeight: 700,
                    lineHeight: 1.6,
                    color: "var(--cv4-text-primary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {text.split("\n")[0]}
                </p>
                <p
                  style={{
                    fontFamily: "Manrope, sans-serif",
                    fontSize: 12,
                    lineHeight: 1.6,
                    color: "var(--cv4-text-muted)",
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {text.split("\n").slice(1).join("\n")}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="flex flex-col items-center justify-center"
            style={{ height: 100, background: "var(--cv4-surface-secondary)" }}
          >
            <FileText size={28} style={{ color: "var(--cv4-text-disabled)" }} />
          </div>
        )}
        {!hasContent && (
          <div style={{ padding: "12px 16px" }} className="flex flex-col gap-2">
            {["✏ 自己编写内容", "▶ 文生视频", "🖼 图片反推提示词", "🎵 文字生音乐"].map((hint) => (
              <span
                key={hint}
                style={{ fontFamily: "Manrope, sans-serif", fontSize: 12, color: "var(--cv4-text-disabled)" }}
              >
                {hint}
              </span>
            ))}
          </div>
        )}
      </NodeShell>
    </div>
  );
}
