"use client";
import type { NodeProps } from "@xyflow/react";
import { Image as ImageIcon } from "lucide-react";
import { NodeShell } from "./shared/node-shell";
import { useNodeFocus } from "../hooks/use-node-focus";
import { useNodeExecution } from "../hooks/use-node-execution";
import { useNodePersistence } from "../hooks/use-node-persistence";

export function ImageNode({ id, data }: NodeProps) {
  const d = data as Record<string, unknown>;
  const resultUrl = (d.result_url as string) || "";
  const hasContent = resultUrl.length > 0;
  const status = (d.status as string) || "idle";
  const modelName = (d.model as string) || "";
  const aspectRatio = (d.aspect_ratio as string) || "";
  const { focusedNodeId, handleNodeClick } = useNodeFocus();

  useNodeExecution(id);
  useNodePersistence(id);

  return (
    <div onClick={() => handleNodeClick(id, "image", hasContent)}>
      <NodeShell
        nodeId={id}
        nodeType="image"
        hasContent={hasContent}
        status={status as "idle" | "queued" | "running" | "completed" | "failed" | "timeout" | "blocked"}
        isFocused={focusedNodeId === id}
      >
        {hasContent ? (
          <>
            <div style={{ overflow: "hidden" }}>
              <img
                src={resultUrl}
                alt=""
                style={{
                  width: "100%",
                  maxHeight: 240,
                  objectFit: "cover",
                  display: "block",
                }}
              />
            </div>
            {(modelName || aspectRatio) && (
              <div
                className="flex items-center"
                style={{ padding: "8px 16px" }}
              >
                <span
                  style={{
                    fontFamily: "Space Grotesk, sans-serif",
                    fontSize: 10,
                    color: "var(--cv4-text-disabled)",
                  }}
                >
                  {modelName}
                </span>
                <span className="flex-1" />
                <span
                  style={{
                    fontFamily: "Space Grotesk, sans-serif",
                    fontSize: 10,
                    color: "var(--cv4-text-disabled)",
                  }}
                >
                  {aspectRatio}
                </span>
              </div>
            )}
          </>
        ) : (
          <div
            className="flex flex-col items-center justify-center"
            style={{ height: 130, background: "var(--cv4-surface-secondary)" }}
          >
            <ImageIcon size={28} style={{ color: "var(--cv4-text-disabled)" }} />
          </div>
        )}
        {!hasContent && (
          <div style={{ padding: "12px 16px" }} className="flex flex-col gap-2">
            {["↑ 图生图", "HD 图片高清"].map((hint) => (
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
