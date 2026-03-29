"use client";
import { useState, useRef, useEffect } from "react";
import {
  Plus,
  GitBranch,
  Package,
  History,
  Info,
  FileText,
  Image,
  PlayCircle,
  Music,
} from "lucide-react";

interface LeftFloatingMenuProps {
  onAddNode: (nodeType: string) => void;
  onToggleAssets?: () => void;
}

const NODE_OPTIONS = [
  { type: "text", label: "文本", icon: FileText },
  { type: "image", label: "图片", icon: Image },
  { type: "video", label: "视频", icon: PlayCircle },
  { type: "audio", label: "音频", icon: Music },
] as const;

export function LeftFloatingMenu({ onAddNode, onToggleAssets }: LeftFloatingMenuProps) {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPicker]);

  return (
    <div
      className="absolute flex flex-col items-center"
      style={{
        left: 24,
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 40,
        width: 48,
        background: "var(--cv4-surface-overlay)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderRadius: "var(--cv4-radius-menu)",
        border: "1px solid var(--cv4-border-subtle)",
        boxShadow: "var(--cv4-shadow-lg)",
        padding: "8px 0",
        gap: 4,
      }}
    >
      {/* Add node button */}
      <div className="relative" ref={pickerRef}>
        <ToolbarButton
          onClick={() => setShowPicker((v) => !v)}
          hasBg
        >
          <Plus size={18} style={{ color: "var(--cv4-text-primary)" }} />
        </ToolbarButton>

        {showPicker && (
          <div
            className="absolute flex flex-col gap-1"
            style={{
              left: 52,
              top: 0,
              minWidth: 120,
              background: "var(--cv4-surface-primary)",
              borderRadius: "var(--cv4-radius-menu)",
              border: "1px solid var(--cv4-border-default)",
              boxShadow: "var(--cv4-shadow-md)",
              padding: 6,
              animation: "cv4-panel-enter 150ms ease-out",
            }}
          >
            {NODE_OPTIONS.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                onClick={() => {
                  onAddNode(type);
                  setShowPicker(false);
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
                  {label}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ width: 28, height: 1, background: "var(--cv4-border-default)" }} />

      {/* Workflow view */}
      <ToolbarButton>
        <GitBranch size={16} style={{ color: "var(--cv4-text-muted)" }} />
      </ToolbarButton>

      {/* Assets */}
      <ToolbarButton onClick={onToggleAssets}>
        <Package size={16} style={{ color: "var(--cv4-text-muted)" }} />
      </ToolbarButton>

      {/* History */}
      <ToolbarButton>
        <History size={16} style={{ color: "var(--cv4-text-muted)" }} />
      </ToolbarButton>

      {/* Help */}
      <ToolbarButton>
        <Info size={16} style={{ color: "var(--cv4-text-muted)" }} />
      </ToolbarButton>

      {/* User avatar */}
      <ToolbarButton>
        <div
          className="flex items-center justify-center"
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            background: "var(--cv4-surface-primary)",
          }}
        >
          <span style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 11, color: "var(--cv4-text-secondary)" }}>
            U
          </span>
        </div>
      </ToolbarButton>
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  hasBg,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  hasBg?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center cursor-pointer shrink-0"
      style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        background: hasBg ? "var(--cv4-surface-primary)" : "transparent",
        border: hasBg ? "1px solid var(--cv4-border-default)" : "none",
        transition: "background 100ms",
      }}
      onMouseEnter={(e) => {
        if (!hasBg) e.currentTarget.style.background = "var(--cv4-hover-highlight)";
      }}
      onMouseLeave={(e) => {
        if (!hasBg) e.currentTarget.style.background = "transparent";
      }}
    >
      {children}
    </button>
  );
}
