"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import {
  Palette,
  MapPin,
  Target,
  Maximize2,
  ChevronDown,
  Zap,
  ArrowUp,
  Upload,
  Loader2,
  Camera,
} from "lucide-react";
import { usePromptBuilder } from "../hooks/use-prompt-builder";
import { useNodeExecution } from "../hooks/use-node-execution";
import { useCanvasStore } from "@/stores/canvas-store";
import { ModelSelector } from "@/components/common/model-selector";

interface AIGeneratePanelProps {
  nodeId: string;
  quotaExceeded?: boolean;
}

const TAGS = [
  { icon: Palette, label: "风格" },
  { icon: MapPin, label: "标记" },
  { icon: Target, label: "聚焦" },
] as const;

const nodePromptCache = new Map<string, string>();

export function AIGeneratePanel({ nodeId, quotaExceeded = false }: AIGeneratePanelProps) {
  const [prompt, setPrompt] = useState(() => nodePromptCache.get(nodeId) ?? "");
  const prevNodeIdRef = useRef(nodeId);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { finalPrompt, upstreamImages } = usePromptBuilder(nodeId);
  const { canvasId, focusedNodeType, nodeModelSelections, setNodeModel } = useCanvasStore();
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
  const isDisabled = quotaExceeded || isExecuting;

  const modelType: "llm" | "image" | "all" =
    focusedNodeType === "text" ? "llm"
    : focusedNodeType === "image" ? "image"
    : "all";

  const skillForNodeType = (type: string | null) => {
    switch (type) {
      case "image": return "visual.generate_image";
      case "video": return "video.generate_video";
      case "text": return "text.generate";
      default: return "visual.generate_image";
    }
  };

  const handleSend = useCallback(async () => {
    if (isDisabled) return;
    const combined = [prompt, finalPrompt].filter(Boolean).join("\n\n");
    if (!combined.trim()) return;

    const skillName = skillForNodeType(focusedNodeType);
    const selectedModel = nodeModelSelections[nodeId];
    const params: Record<string, unknown> = { prompt: combined };
    if (selectedModel) {
      params.model_name = selectedModel;
    }
    if (upstreamImages.length > 0) {
      params.reference_images = upstreamImages;
    }

    await execute(skillName, params);
    setPrompt("");
    nodePromptCache.delete(nodeId);
  }, [prompt, finalPrompt, upstreamImages, isDisabled, nodeId, focusedNodeType, execute]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !canvasId) return;

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
    text: "描述你想要生成的文本内容，按/呼出指令，@引用素材",
    image: "描述你想要生成的画面内容，按/呼出指令，@引用素材",
    video: "描述你想要生成的视频内容，按/呼出指令，@引用素材",
    audio: "描述你想要生成的音频内容，按/呼出指令，@引用素材",
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
      {/* Execution status bar */}
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

      {/* Tags row */}
      <div className="flex items-center gap-2" style={{ padding: "12px 16px 8px 16px" }}>
        {TAGS.map(({ icon: Icon, label }) => (
          <button
            key={label}
            className="flex items-center gap-1 cursor-pointer"
            style={{
              padding: "8px 12px",
              background: "var(--cv4-surface-primary)",
              borderRadius: "var(--cv4-radius-tag)",
              border: "none",
            }}
          >
            <Icon size={14} style={{ color: "var(--cv4-text-secondary)" }} />
            <span style={{ fontFamily: "Manrope, sans-serif", fontSize: 12, color: "var(--cv4-text-secondary)" }}>
              {label}
            </span>
          </button>
        ))}
        <span className="flex-1" />
        <Maximize2 size={16} style={{ color: "var(--cv4-text-disabled)", cursor: "pointer" }} />
      </div>

      {/* Input area */}
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

      {/* Bottom bar */}
      <div className="flex items-center gap-2" style={{ padding: "8px 16px 12px 16px" }}>
        {/* Model selector */}
        <ModelSelector
          value={nodeModelSelections[nodeId] ?? null}
          onChange={(name) => setNodeModel(nodeId, name)}
          modelType={modelType}
          size="sm"
          disabled={isExecuting}
        />

        {/* Aspect ratio pill */}
        <button
          className="flex items-center gap-1 cursor-pointer"
          style={{
            padding: "8px 12px",
            background: "var(--cv4-surface-primary)",
            borderRadius: "var(--cv4-radius-tag)",
            border: "none",
          }}
        >
          <span style={{ fontFamily: "Manrope, sans-serif", fontSize: 12, color: "var(--cv4-text-secondary)" }}>
            16:9 · 2K
          </span>
        </button>

        {/* Camera control pill */}
        <button
          className="flex items-center gap-1 cursor-pointer"
          style={{
            padding: "8px 12px",
            background: "var(--cv4-surface-primary)",
            borderRadius: "var(--cv4-radius-tag)",
            border: "none",
          }}
        >
          <Camera size={12} style={{ color: "var(--cv4-text-secondary)" }} />
          <span style={{ fontFamily: "Manrope, sans-serif", fontSize: 12, color: "var(--cv4-text-secondary)" }}>
            摄像机控制
          </span>
        </button>

        <span className="flex-1" />

        {/* File upload */}
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
            border: "none",
          }}
        >
          <Upload size={14} style={{ color: "var(--cv4-text-secondary)" }} />
        </button>

        {/* Count selector */}
        <button
          className="flex items-center gap-1 cursor-pointer"
          style={{ fontFamily: "Manrope, sans-serif", fontSize: 12, color: "var(--cv4-text-secondary)", background: "none", border: "none" }}
        >
          1张
          <ChevronDown size={10} style={{ color: "var(--cv4-text-disabled)" }} />
        </button>

        {/* Divider */}
        <div style={{ width: 1, height: 16, background: "var(--cv4-border-divider)" }} />

        {/* Quota indicator */}
        <Zap
          size={12}
          style={{ color: quotaExceeded ? "#EF4444" : "var(--cv4-text-disabled)" }}
        />
        <span style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 12, color: "var(--cv4-text-disabled)" }}>
          14
        </span>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={isDisabled}
          title={quotaExceeded ? "额度已用完 — 升级计划或联系管理员" : isExecuting ? "执行中..." : "发送 (Ctrl+Enter)"}
          className="flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
          style={{
            width: 30,
            height: 30,
            borderRadius: "var(--cv4-radius-button)",
            background: "var(--cv4-btn-primary)",
            border: "none",
            opacity: isDisabled ? 0.5 : 1,
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
