"use client";
import {
  Expand,
  RotateCcw,
  Sun,
  Pencil,
  Eraser,
  Scissors,
  Grid3x3,
  PenTool,
  Crop,
  Download,
  Maximize2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface ImageToolbarProps {
  nodeId: string;
}

interface TemplateSkill {
  icon: LucideIcon | null;
  textIcon?: string;
  label: string;
  skill: string;
}

interface UtilityButton {
  icon: LucideIcon;
  label: string;
  action: string;
}

const TEMPLATE_SKILLS: TemplateSkill[] = [
  { icon: null, textIcon: "HD", label: "高清", skill: "visual.upscale" },
  { icon: Expand, label: "扩图", skill: "visual.outpaint" },
  { icon: RotateCcw, label: "多角度", skill: "visual.multiview" },
  { icon: Sun, label: "打光", skill: "visual.relight" },
  { icon: Pencil, label: "重绘", skill: "visual.inpaint" },
  { icon: Eraser, label: "擦除", skill: "visual.erase" },
  { icon: Scissors, label: "抠图", skill: "visual.segment" },
];

const UTILITY_BUTTONS: UtilityButton[] = [
  { icon: Grid3x3, label: "九宫格", action: "grid" },
  { icon: PenTool, label: "画笔标注", action: "annotate" },
  { icon: Crop, label: "裁剪", action: "crop" },
  { icon: Download, label: "下载", action: "download" },
  { icon: Maximize2, label: "放大预览", action: "preview" },
];

export function ImageToolbar({ nodeId: _nodeId }: ImageToolbarProps) {
  return (
    <div
      className="flex items-center"
      role="toolbar"
      style={{
        gap: 4,
        padding: "4px 8px",
        background: "var(--cv4-surface-elevated)",
        borderRadius: 10,
        border: "1px solid var(--cv4-border-default)",
        boxShadow: "var(--cv4-shadow-sm)",
      }}
    >
      {/* Template skills — all disabled until skill registry wired */}
      {TEMPLATE_SKILLS.map((skill) => {
        const Icon = skill.icon;
        return (
          <button
            key={skill.skill}
            aria-disabled="true"
            title="即将上线"
            className="flex items-center shrink-0"
            style={{
              height: 28,
              padding: "4px 8px",
              borderRadius: 6,
              gap: 4,
              background: "transparent",
              border: "none",
              opacity: 0.4,
              cursor: "not-allowed",
              pointerEvents: "auto",
            }}
          >
            {skill.textIcon ? (
              <span
                style={{
                  fontFamily: "Space Grotesk, sans-serif",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--cv4-text-secondary)",
                }}
              >
                {skill.textIcon}
              </span>
            ) : Icon ? (
              <Icon size={12} style={{ color: "var(--cv4-text-secondary)" }} />
            ) : null}
            <span
              style={{
                fontFamily: "Manrope, sans-serif",
                fontSize: 11,
                color: "var(--cv4-text-secondary)",
                whiteSpace: "nowrap",
              }}
            >
              {skill.label}
            </span>
          </button>
        );
      })}

      {/* Divider */}
      <div
        style={{
          width: 1,
          height: 16,
          background: "var(--cv4-border-divider)",
          flexShrink: 0,
        }}
      />

      {/* Utility buttons */}
      {UTILITY_BUTTONS.map((btn) => {
        const Icon = btn.icon;
        return (
          <button
            key={btn.action}
            aria-label={btn.label}
            className="flex items-center justify-center shrink-0 cursor-pointer"
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
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
            <Icon size={14} style={{ color: "var(--cv4-text-secondary)" }} />
          </button>
        );
      })}
    </div>
  );
}
