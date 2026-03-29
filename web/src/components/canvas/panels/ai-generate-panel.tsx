"use client";
import { useState, useCallback, useRef } from "react";
import {
  Palette,
  MapPin,
  Target,
  Maximize2,
  Sparkles,
  ChevronDown,
  Zap,
  ArrowUp,
} from "lucide-react";
import { usePromptBuilder } from "../hooks/use-prompt-builder";
import { skillsApi } from "@/lib/api";
import { useCanvasStore } from "@/stores/canvas-store";

interface AIGeneratePanelProps {
  nodeId: string;
  quotaExceeded?: boolean;
}

const TAGS = [
  { icon: Palette, label: "风格" },
  { icon: MapPin, label: "标记" },
  { icon: Target, label: "聚焦" },
] as const;

export function AIGeneratePanel({ nodeId, quotaExceeded = false }: AIGeneratePanelProps) {
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { finalPrompt, upstreamImages } = usePromptBuilder(nodeId);
  const { canvasId, projectId } = useCanvasStore();

  const handleSend = useCallback(async () => {
    if (quotaExceeded || sending) return;
    const combined = [prompt, finalPrompt].filter(Boolean).join("\n\n");
    if (!combined.trim()) return;

    setSending(true);
    try {
      await skillsApi.invoke({
        skill_name: "visual.generate_image",
        params: {
          prompt: combined,
          reference_images: upstreamImages,
        },
        project_id: projectId ?? undefined,
        canvas_id: canvasId ?? undefined,
        node_id: nodeId,
        idempotency_key: `${nodeId}_${Date.now()}`,
      });
    } finally {
      setSending(false);
    }
  }, [prompt, finalPrompt, upstreamImages, quotaExceeded, sending, nodeId, canvasId, projectId]);

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
            }}
          >
            <Icon size={14} style={{ color: "var(--cv4-text-secondary)" }} />
            <span
              style={{
                fontFamily: "Manrope, sans-serif",
                fontSize: 12,
                color: "var(--cv4-text-secondary)",
              }}
            >
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
          placeholder="描述你想要生成的画面内容，按/呼出指令，@引用素材"
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
        {/* Model selector pill */}
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

        {/* Aspect ratio pill */}
        <button
          className="flex items-center gap-1 cursor-pointer"
          style={{
            padding: "8px 12px",
            background: "var(--cv4-surface-primary)",
            borderRadius: "var(--cv4-radius-tag)",
          }}
        >
          <span style={{ fontFamily: "Manrope, sans-serif", fontSize: 12, color: "var(--cv4-text-secondary)" }}>
            16:9 · 2K
          </span>
        </button>

        <span className="flex-1" />

        {/* Count selector */}
        <button
          className="flex items-center gap-1 cursor-pointer"
          style={{ fontFamily: "Manrope, sans-serif", fontSize: 12, color: "var(--cv4-text-secondary)" }}
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
          disabled={quotaExceeded || sending}
          title={quotaExceeded ? "额度已用完 — 升级计划或联系管理员" : "发送"}
          className="flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
          style={{
            width: 30,
            height: 30,
            borderRadius: "var(--cv4-radius-button)",
            background: "var(--cv4-btn-primary)",
            opacity: quotaExceeded ? 0.5 : 1,
          }}
        >
          <ArrowUp size={16} style={{ color: "var(--cv4-btn-primary-text)" }} />
        </button>
      </div>
    </div>
  );
}
