"use client";
import { Sparkles, LayoutGrid, User, Palette, Video } from "lucide-react";

interface TemplateMenuProps {
  nodeId: string;
}

const IMAGE_TEMPLATES = [
  { icon: LayoutGrid, label: "九宫格场景" },
  { icon: User, label: "角色三视图" },
  { icon: Palette, label: "风格迁移" },
  { icon: Video, label: "图生视频" },
] as const;

export function TemplateMenu({ nodeId: _nodeId }: TemplateMenuProps) {
  return (
    <div
      style={{
        width: 370,
        background: "var(--cv4-surface-elevated)",
        borderRadius: "var(--cv4-radius-menu)",
        border: "1px solid var(--cv4-border-default)",
        boxShadow: "var(--cv4-shadow-lg)",
        padding: "12px 16px",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
        <Sparkles size={12} style={{ color: "var(--cv4-text-secondary)" }} />
        <span
          style={{
            fontFamily: "Manrope, sans-serif",
            fontSize: 12,
            fontWeight: 700,
            color: "var(--cv4-text-secondary)",
          }}
        >
          模板功能
        </span>
        <span className="flex-1" />
        <button
          className="cursor-pointer"
          style={{
            fontFamily: "Manrope, sans-serif",
            fontSize: 9,
            color: "var(--cv4-text-disabled)",
            background: "none",
            border: "none",
          }}
        >
          查看全部 ›
        </button>
      </div>

      {/* Template chips */}
      <div className="flex items-center gap-2 overflow-x-auto" style={{ paddingBottom: 2 }}>
        {IMAGE_TEMPLATES.map(({ icon: Icon, label }) => (
          <button
            key={label}
            onClick={() => {
              /* template application deferred to Plan 07 */
            }}
            className="flex items-center gap-1 cursor-pointer shrink-0"
            style={{
              padding: "8px 12px",
              background: "var(--cv4-surface-primary)",
              border: "1px solid var(--cv4-border-default)",
              borderRadius: "var(--cv4-radius-tag)",
            }}
          >
            <Icon size={12} style={{ color: "var(--cv4-text-muted)", opacity: 0.9 }} />
            <span
              style={{
                fontFamily: "Manrope, sans-serif",
                fontSize: 9,
                color: "var(--cv4-text-secondary)",
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
