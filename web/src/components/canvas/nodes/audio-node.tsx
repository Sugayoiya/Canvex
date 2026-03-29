"use client";
import { useRef, useCallback } from "react";
import type { NodeProps } from "@xyflow/react";
import { useReactFlow } from "@xyflow/react";
import { Music, Upload, Loader2 } from "lucide-react";
import { NodeShell } from "./shared/node-shell";
import { useNodeFocus } from "../hooks/use-node-focus";
import { useNodeExecution } from "../hooks/use-node-execution";
import { canvasApi, API_BASE_URL } from "@/lib/api";

export function AudioNode({ id, data }: NodeProps) {
  const d = data as Record<string, unknown>;
  const audioUrl = (d.result_audio_url as string) || (d.result_url as string) || "";
  const hasContent = audioUrl.length > 0;
  const status = (d.status as string) || "idle";
  const errorMessage = (d.error_message as string) || "";
  const { focusedNodeId, handleNodeClick } = useNodeFocus();
  const { status: execStatus } = useNodeExecution(id);
  const { setNodes } = useReactFlow();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resolveUrl = (url: string) => {
    if (!url) return "";
    if (url.startsWith("http") || url.startsWith("blob:")) return url;
    return `${API_BASE_URL}${url}`;
  };

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const localUrl = URL.createObjectURL(file);
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id
            ? { ...n, data: { ...n.data, result_url: localUrl, result_audio_url: localUrl, status: "completed" } }
            : n,
        ),
      );
      canvasApi.updateNode(id, { result_url: localUrl, status: "completed" }).catch(() => {});
      e.target.value = "";
    },
    [id, setNodes],
  );

  const isExecuting = execStatus === "queued" || execStatus === "running";

  return (
    <div onClick={() => handleNodeClick(id, "audio", hasContent)}>
      <NodeShell
        nodeId={id}
        nodeType="audio"
        hasContent={hasContent}
        status={status as "idle" | "queued" | "running" | "completed" | "failed" | "timeout" | "blocked"}
        isFocused={focusedNodeId === id}
      >
        {hasContent ? (
          <div style={{ padding: "12px 16px" }}>
            <audio
              src={resolveUrl(audioUrl)}
              controls
              className="nodrag nowheel"
              style={{ width: "100%", height: 36 }}
            />
          </div>
        ) : (
          <div
            className="flex flex-col items-center justify-center gap-3"
            style={{ height: 110, background: "var(--cv4-surface-secondary)" }}
          >
            {isExecuting ? (
              <>
                <Loader2 size={28} className="animate-spin" style={{ color: "var(--cv4-text-muted)" }} />
                <span style={{ fontFamily: "Manrope, sans-serif", fontSize: 11, color: "var(--cv4-text-muted)" }}>
                  AI 生成音频中...
                </span>
              </>
            ) : (
              <>
                <Music size={28} style={{ color: "var(--cv4-text-disabled)" }} />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleUpload}
                  className="hidden"
                />
                <button
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  className="flex items-center gap-1 cursor-pointer"
                  style={{
                    padding: "6px 12px",
                    background: "var(--cv4-surface-primary)",
                    borderRadius: "var(--cv4-radius-tag)",
                    border: "1px solid var(--cv4-border-default)",
                  }}
                >
                  <Upload size={12} style={{ color: "var(--cv4-text-secondary)" }} />
                  <span style={{ fontFamily: "Manrope, sans-serif", fontSize: 11, color: "var(--cv4-text-secondary)" }}>
                    上传音频
                  </span>
                </button>
                <span style={{ fontFamily: "Manrope, sans-serif", fontSize: 10, color: "var(--cv4-text-disabled)" }}>
                  或用下方 AI 生成
                </span>
              </>
            )}
          </div>
        )}
        {status === "failed" && errorMessage && (
          <div style={{ padding: "8px 16px" }}>
            <span style={{ fontFamily: "Manrope, sans-serif", fontSize: 11, color: "#EF4444" }}>
              {errorMessage}
            </span>
          </div>
        )}
      </NodeShell>
    </div>
  );
}
