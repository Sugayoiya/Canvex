"use client";
import { useEffect, useRef, useCallback } from "react";
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
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const focusIndexRef = useRef(0);
  const compatibleTypes = getCompatibleTargetTypes(sourceNodeType as MaterialType);

  const focusItem = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, compatibleTypes.length - 1));
    focusIndexRef.current = clamped;
    itemRefs.current[clamped]?.focus();
  }, [compatibleTypes.length]);

  useEffect(() => {
    if (compatibleTypes.length > 0) {
      requestAnimationFrame(() => focusItem(0));
    }
  }, [focusItem, compatibleTypes.length]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          focusItem(focusIndexRef.current + 1);
          break;
        case "ArrowUp":
          e.preventDefault();
          focusItem(focusIndexRef.current - 1);
          break;
        case "Home":
          e.preventDefault();
          focusItem(0);
          break;
        case "End":
          e.preventDefault();
          focusItem(compatibleTypes.length - 1);
          break;
        case "Escape":
        case "Tab":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [onClose, focusItem, compatibleTypes.length],
  );

  if (compatibleTypes.length === 0) return null;

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="选择节点类型"
      onKeyDown={handleKeyDown}
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
      {compatibleTypes.map((type, i) => {
        const meta = NODE_META[type];
        if (!meta) return null;
        const Icon = meta.icon;
        return (
          <button
            key={type}
            ref={(el) => { itemRefs.current[i] = el; }}
            role="menuitem"
            type="button"
            tabIndex={-1}
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
              outline: "none",
              transition: "background 100ms",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--cv4-hover-highlight)";
              focusItem(i);
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
            onFocus={(e) => {
              e.currentTarget.style.background = "var(--cv4-hover-highlight)";
            }}
            onBlur={(e) => {
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
