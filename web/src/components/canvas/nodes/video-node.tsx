"use client";
import type { NodeProps } from "@xyflow/react";
import { PlayCircle } from "lucide-react";
import { NodeShell } from "./shared/node-shell";
import { useNodeFocus } from "../hooks/use-node-focus";
import { useNodeExecution } from "../hooks/use-node-execution";
import { useNodePersistence } from "../hooks/use-node-persistence";

export function VideoNode({ id, data }: NodeProps) {
  const d = data as Record<string, unknown>;
  const videoUrl = (d.result_video_url as string) || (d.result_url as string) || "";
  const hasContent = videoUrl.length > 0;
  const status = (d.status as string) || "idle";
  const { focusedNodeId, handleNodeClick } = useNodeFocus();

  useNodeExecution(id);
  useNodePersistence(id);

  return (
    <div onClick={() => handleNodeClick(id, "video", hasContent)}>
      <NodeShell
        nodeId={id}
        nodeType="video"
        hasContent={hasContent}
        status={status as "idle" | "queued" | "running" | "completed" | "failed" | "timeout" | "blocked"}
        isFocused={focusedNodeId === id}
      >
        {hasContent ? (
          <div style={{ overflow: "hidden", position: "relative" }}>
            <video
              src={videoUrl}
              style={{
                width: "100%",
                maxHeight: 240,
                objectFit: "cover",
                display: "block",
              }}
              muted
              playsInline
              preload="metadata"
            />
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: "rgba(0,0,0,0.15)", pointerEvents: "none" }}
            >
              <PlayCircle size={36} style={{ color: "rgba(255,255,255,0.85)" }} />
            </div>
          </div>
        ) : (
          <div
            className="flex flex-col items-center justify-center"
            style={{ height: 140, background: "var(--cv4-surface-secondary)" }}
          >
            <PlayCircle size={28} style={{ color: "var(--cv4-text-disabled)" }} />
          </div>
        )}
        {!hasContent && (
          <div style={{ padding: "12px 16px" }} className="flex flex-col gap-2">
            {["🎬 首尾帧生成视频", "▶ 首帧生成视频"].map((hint) => (
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
