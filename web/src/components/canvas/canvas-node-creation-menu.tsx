"use client";
import { useEffect, useRef } from "react";
import { FileText, Image, PlayCircle, Music } from "lucide-react";
import { getCompatibleTargetTypes, type MaterialType } from "@/lib/connection-rules";

interface NodeCreationMenuProps {
  position: { x: number; y: number };
  sourceNodeType: string;
  onSelect: (nodeType: string) => void;
  onClose: () => void;
}

const NODE_META: Record<MaterialType, { label: string; icon: typeof FileText }> = {
  text: { label: "文本", icon: FileText },
  image: { label: "图片", icon: Image },
  video: { label: "视频", icon: PlayCircle },
  audio: { label: "音频", icon: Music },
};

export function NodeCreationMenu({ position, sourceNodeType, onSelect, onClose }: NodeCreationMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const compatibleTypes = getCompatibleTargetTypes(sourceNodeType as MaterialType);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (compatibleTypes.length === 0) return null;

  return (
    <div
      ref={ref}
      className="fixed flex flex-col gap-1"
      style={{
        left: position.x,
        top: position.y,
        zIndex: 60,
        minWidth: 130,
        background: "var(--cv4-surface-primary)",
        borderRadius: "var(--cv4-radius-menu)",
        border: "1px solid var(--cv4-border-default)",
        boxShadow: "var(--cv4-shadow-md)",
        padding: 6,
        animation: "cv4-panel-enter 150ms ease-out",
      }}
    >
      {compatibleTypes.map((type) => {
        const meta = NODE_META[type];
        if (!meta) return null;
        const Icon = meta.icon;
        return (
          <button
            key={type}
            onClick={() => {
              onSelect(type);
              onClose();
            }}
            className="flex items-center gap-2 cursor-pointer w-full"
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              background: "transparent",
              border: "none",
              transition: "background 100ms",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--cv4-hover-highlight)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <Icon size={14} style={{ color: "var(--cv4-text-muted)" }} />
            <span style={{ fontFamily: "Manrope, sans-serif", fontSize: 12, color: "var(--cv4-text-secondary)" }}>
              {meta.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
