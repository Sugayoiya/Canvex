"use client";
import { useState, useCallback } from "react";
import { Download } from "lucide-react";

interface VideoToolbarProps {
  nodeId: string;
}

const SPEED_CYCLE = [1, 1.5, 2, 0.5] as const;

export function VideoToolbar({ nodeId: _nodeId }: VideoToolbarProps) {
  const [speedIdx, setSpeedIdx] = useState(0);
  const currentSpeed = SPEED_CYCLE[speedIdx];

  const handleSpeedToggle = useCallback(() => {
    setSpeedIdx((prev) => (prev + 1) % SPEED_CYCLE.length);
  }, []);

  const speedLabel = currentSpeed === 1 ? "1x" : `${currentSpeed}x`;

  return (
    <div
      className="flex items-center"
      role="toolbar"
      style={{
        gap: 8,
        padding: "4px 8px",
        background: "var(--cv4-surface-elevated)",
        borderRadius: 10,
        border: "1px solid var(--cv4-border-default)",
        boxShadow: "var(--cv4-shadow-sm)",
      }}
    >
      <button
        onClick={handleSpeedToggle}
        className="flex items-center justify-center cursor-pointer shrink-0"
        title="倍速"
        style={{
          height: 28,
          padding: "4px 8px",
          borderRadius: 6,
          background: "transparent",
          border: "none",
          fontFamily: "Space Grotesk, sans-serif",
          fontSize: 13,
          fontWeight: 700,
          color: "var(--cv4-text-secondary)",
          transition: "background 100ms",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--cv4-hover-highlight)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        {speedLabel}
      </button>

      <button
        aria-label="下载"
        className="flex items-center justify-center cursor-pointer shrink-0"
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
        <Download size={14} style={{ color: "var(--cv4-text-secondary)" }} />
      </button>
    </div>
  );
}
