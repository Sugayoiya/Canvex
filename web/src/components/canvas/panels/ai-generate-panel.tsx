"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import {
  Sparkles,
  ChevronDown,
  Zap,
  ArrowUp,
  Upload,
  Loader2,
} from "lucide-react";
import { usePromptBuilder } from "../hooks/use-prompt-builder";
import { useNodeExecution } from "../hooks/use-node-execution";
import { useCanvasStore } from "@/stores/canvas-store";

interface AIGeneratePanelProps {
  nodeId: string;
}

const nodePromptCache = new Map<string, string>();

export function AIGeneratePanel({ nodeId }: AIGeneratePanelProps) {
  const [prompt, setPrompt] = useState(() => nodePromptCache.get(nodeId) ?? "");
  const prevNodeIdRef = useRef(nodeId);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { finalPrompt, upstreamImages } = usePromptBuilder(nodeId);
  const { canvasId, projectId, focusedNodeType } = useCanvasStore();
  const { status: execStatus, message: execMessage, execute } = useNodeExecution(nodeId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (nodeId !== prevNodeIdRef.current) {
      nodePromptCache.set(prevNodeIdRef.current, prompt);
      setPrompt(nodePromptCache.get(nodeId) ?? "");
      prevNodeIdRef.current = nodeId;
    }
  }, [nodeId, prompt]);

  useEffect(() => {
    nodePromptCache.set(nodeId, prompt);
  }, [nodeId, prompt]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [nodeId]);

  const isExecuting = execStatus === "queued" || execStatus === "running";

  const skillForNodeType = (type: string | null) => {
    switch (type) {
      case "image": return "visual.generate_image";
      case "video": return "video.generate_video";
      case "text": return "text.generate";
      default: return "visual.generate_image";
    }
  };

  const handleSend = useCallback(async () => {
    if (isExecuting) return;
    const combined = [prompt, finalPrompt].filter(Boolean).join("\n\n");
    if (!combined.trim()) return;

    const skillName = skillForNodeType(focusedNodeType);
    const params: Record<string, unknown> = { prompt: combined };
    if (upstreamImages.length > 0) {
      params.reference_images = upstreamImages;
    }

    await execute(skillName, params);
    setPrompt("");
    nodePromptCache.delete(nodeId);
  }, [prompt, finalPrompt, upstreamImages, isExecuting, nodeId, focusedNodeType, execute]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !canvasId) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("canvas_id", canvasId);
    formData.append("node_id", nodeId);

    try {
      const { canvasApi } = await import("@/lib/api");
      const url = URL.createObjectURL(file);
      await canvasApi.updateNode(nodeId, { result_url: url, status: "completed" });
    } catch (err) {
      console.warn("[AIGeneratePanel] upload failed:", err);
    }
    e.target.value = "";
  }, [canvasId, nodeId]);

  const placeholderByType: Record<string, string> = {
    text: "描述你想要生成的文本内容，Ctrl+Enter 发送",
    image: "描述你想要生成的画面内容，Ctrl+Enter 发送",
    video: "描述你想要生成的视频内容，Ctrl+Enter 发送",
    audio: "描述你想要生成的音频内容，Ctrl+Enter 发送",
  };

  return (
    <div
      style={{
        width: 460,
        background: "var(--cv4-surface-elevated)",
        borderRadius: "var(--cv4-radius-panel)",
        border: "1px solid var(--cv4-border-default)",
        boxShadow: "var(--cv4-shadow-lg)",
      }}
    >
      {execStatus !== "idle" && execStatus !== "completed" && (
        <div
          className="flex items-center gap-2"
          style={{
            padding: "8px 16px",
            borderBottom: "1px solid var(--cv4-border-subtle)",
            fontSize: 12,
            fontFamily: "Manrope, sans-serif",
            color: execStatus === "failed" ? "#EF4444" : "var(--cv4-text-secondary)",
          }}
        >
          {isExecuting && <Loader2 size={12} className="animate-spin" />}
          <span>{execMessage || execStatus}</span>
        </div>
      )}

      <div style={{ padding: "8px 16px 12px 16px" }}>
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={placeholderByType[focusedNodeType ?? "image"]}
          rows={3}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSend();
            }
          }}
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            outline: "none",
            resize: "none",
            fontFamily: "Manrope, sans-serif",
            fontSize: 13,
            color: "var(--cv4-text-primary)",
            lineHeight: 1.5,
          }}
          className="placeholder:text-[var(--cv4-text-placeholder)]"
        />
      </div>

      <div className="flex items-center gap-2" style={{ padding: "8px 16px 12px 16px" }}>
        <button
          className="flex items-center gap-1 cursor-pointer"
          style={{
            padding: "8px 12px",
            background: "var(--cv4-surface-primary)",
            borderRadius: "var(--cv4-radius-tag)",
          }}
        >
          <Sparkles size={12} style={{ color: "var(--cv4-text-secondary)" }} />
          <span style={{ fontFamily: "Manrope, sans-serif", fontSize: 12, color: "var(--cv4-text-secondary)" }}>
            Gemini
          </span>
          <ChevronDown size={10} style={{ color: "var(--cv4-text-disabled)" }} />
        </button>

        <span className="flex-1" />

        <input
          ref={fileInputRef}
          type="file"
          accept={focusedNodeType === "video" ? "video/*" : focusedNodeType === "audio" ? "audio/*" : "image/*"}
          onChange={handleFileUpload}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center justify-center cursor-pointer"
          title="上传文件"
          style={{
            width: 30,
            height: 30,
            borderRadius: "var(--cv4-radius-button)",
            background: "var(--cv4-surface-primary)",
          }}
        >
          <Upload size={14} style={{ color: "var(--cv4-text-secondary)" }} />
        </button>

        <div style={{ width: 1, height: 16, background: "var(--cv4-border-divider)" }} />

        <Zap size={12} style={{ color: "var(--cv4-text-disabled)" }} />

        <button
          onClick={handleSend}
          disabled={isExecuting}
          title={isExecuting ? "执行中..." : "发送 (Ctrl+Enter)"}
          className="flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
          style={{
            width: 30,
            height: 30,
            borderRadius: "var(--cv4-radius-button)",
            background: "var(--cv4-btn-primary)",
            opacity: isExecuting ? 0.5 : 1,
          }}
        >
          {isExecuting ? (
            <Loader2 size={16} className="animate-spin" style={{ color: "var(--cv4-btn-primary-text)" }} />
          ) : (
            <ArrowUp size={16} style={{ color: "var(--cv4-btn-primary-text)" }} />
          )}
        </button>
      </div>
    </div>
  );
}
