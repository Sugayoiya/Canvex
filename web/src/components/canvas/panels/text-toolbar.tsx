"use client";
import { useState, useCallback } from "react";
import { Pilcrow, List, ListOrdered, Minus, Copy, Maximize2 } from "lucide-react";

interface TextToolbarProps {
  nodeId: string;
}

type FormatKey = "h1" | "h2" | "h3" | "paragraph" | "bold" | "italic" | "list" | "listOrdered" | "hr" | "copy" | "expand";

interface ToolbarButton {
  key: FormatKey;
  type: "text" | "icon" | "divider";
  label?: string;
  icon?: React.ComponentType<{ size: number; style?: React.CSSProperties }>;
  toggleable?: boolean;
}

const TOOLBAR_BUTTONS: ToolbarButton[] = [
  { key: "h1", type: "text", label: "H1", toggleable: true },
  { key: "h2", type: "text", label: "H2", toggleable: true },
  { key: "h3", type: "text", label: "H3", toggleable: true },
  { key: "paragraph", type: "icon", icon: Pilcrow, toggleable: true },
  { key: "bold", type: "text", label: "B", toggleable: true },
  { key: "italic", type: "text", label: "I", toggleable: true },
  { key: "list", type: "divider" },
  { key: "list", type: "icon", icon: List, toggleable: true },
  { key: "listOrdered", type: "icon", icon: ListOrdered, toggleable: true },
  { key: "hr", type: "divider" },
  { key: "hr", type: "icon", icon: Minus },
  { key: "copy", type: "icon", icon: Copy },
  { key: "expand", type: "icon", icon: Maximize2 },
];

export function TextToolbar({ nodeId: _nodeId }: TextToolbarProps) {
  const [active, setActive] = useState<Set<FormatKey>>(new Set());

  const toggle = useCallback((key: FormatKey) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  let dividerIdx = 0;

  return (
    <div
      className="flex items-center gap-1"
      style={{
        width: 310,
        height: 36,
        padding: "4px 8px",
        background: "var(--cv4-surface-primary)",
        borderRadius: "var(--cv4-radius-toolbar)",
        border: "1px solid var(--cv4-border-default)",
        boxShadow: "var(--cv4-shadow-sm)",
      }}
    >
      {TOOLBAR_BUTTONS.map((btn) => {
        if (btn.type === "divider") {
          dividerIdx++;
          return (
            <div
              key={`divider-${dividerIdx}`}
              style={{
                width: 1,
                height: 16,
                background: "var(--cv4-border-divider)",
                flexShrink: 0,
              }}
            />
          );
        }

        const isActive = active.has(btn.key);
        const color = isActive ? "var(--cv4-text-primary)" : "var(--cv4-text-secondary)";
        const bg = isActive ? "var(--cv4-active-highlight)" : "transparent";

        return (
          <button
            key={btn.key + (btn.label ?? "")}
            onClick={() => btn.toggleable && toggle(btn.key)}
            className="flex items-center justify-center cursor-pointer shrink-0"
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: bg,
              transition: "background 100ms",
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.background = "var(--cv4-hover-highlight)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isActive ? "var(--cv4-active-highlight)" : "transparent";
            }}
          >
            {btn.type === "text" ? (
              <span
                style={{
                  fontFamily: "Space Grotesk, sans-serif",
                  fontSize: 12,
                  fontWeight: 700,
                  color,
                  fontStyle: btn.label === "I" ? "italic" : "normal",
                }}
              >
                {btn.label}
              </span>
            ) : btn.icon ? (
              <btn.icon size={14} style={{ color }} />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
