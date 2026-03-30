"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { taskApi } from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  completed: "var(--cv5-status-success)",
  failed: "var(--cv5-status-failed)",
  running: "var(--cv5-status-running)",
  queued: "var(--cv5-status-queued)",
  timeout: "var(--cv5-status-blocked)",
  blocked: "var(--cv5-status-blocked)",
};

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

interface HistoryItem {
  id: string;
  skill_name: string;
  status: string;
  duration_ms: number | null;
  total_cost: string | null;
  queued_at: string;
  completed_at: string | null;
}

interface NodeExecutionHistoryProps {
  nodeId: string;
  isOpen: boolean;
  onClose: () => void;
  anchorPosition: { x: number; y: number };
}

export function NodeExecutionHistory({
  nodeId,
  isOpen,
  onClose,
  anchorPosition,
}: NodeExecutionHistoryProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: history, isLoading } = useQuery({
    queryKey: ["node-history", nodeId],
    queryFn: () =>
      taskApi
        .nodeHistory(nodeId, { limit: 10 })
        .then((r) => r.data as HistoryItem[]),
    enabled: isOpen,
  });

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        left: anchorPosition.x,
        top: anchorPosition.y,
        width: 320,
        maxHeight: 360,
        overflowY: "auto",
        zIndex: 70,
        background: "var(--cv4-surface-popup, var(--cv4-surface-elevated))",
        borderRadius: "var(--cv4-radius-panel, 16px)",
        border: "1px solid var(--cv4-border-default)",
        boxShadow: "var(--cv4-shadow-xl, 0 8px 32px rgba(0,0,0,0.3))",
        animation: "cv4-panel-enter 150ms ease-out",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: "1px solid var(--cv4-border-subtle)",
        }}
      >
        <span
          style={{
            fontFamily: "Space Grotesk, sans-serif",
            fontSize: 13,
            fontWeight: 700,
            color: "var(--cv4-text-primary)",
          }}
        >
          执行历史
        </span>
        <button
          onClick={onClose}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 24,
            height: 24,
            borderRadius: 6,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--cv4-text-muted)",
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div style={{ padding: "8px 16px" }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                height: 48,
                padding: "8px 0",
                display: "flex",
                alignItems: "center",
                gap: 10,
                borderBottom: "1px solid var(--cv4-border-subtle)",
              }}
            >
              <div
                className="animate-pulse"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "var(--cv4-text-disabled)",
                  flexShrink: 0,
                }}
              />
              <div
                className="animate-pulse"
                style={{
                  height: 12,
                  flex: 1,
                  borderRadius: 4,
                  background: "var(--cv4-text-disabled)",
                  opacity: 0.3,
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!history || history.length === 0) && (
        <div
          style={{
            padding: "32px 16px",
            textAlign: "center",
            fontFamily: "Manrope, sans-serif",
            fontSize: 13,
            color: "var(--cv4-text-disabled)",
          }}
        >
          暂无执行记录
        </div>
      )}

      {/* History list */}
      {!isLoading &&
        history &&
        history.length > 0 &&
        history.map((item) => (
          <div
            key={item.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              height: 48,
              padding: "8px 16px",
              borderBottom: "1px solid var(--cv4-border-subtle)",
            }}
          >
            {/* Status dot */}
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background:
                  STATUS_COLORS[item.status] ?? "var(--cv4-text-disabled)",
                flexShrink: 0,
              }}
            />
            {/* Skill name */}
            <span
              style={{
                flex: 1,
                fontFamily: "Manrope, sans-serif",
                fontSize: 13,
                color: "var(--cv4-text-primary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {item.skill_name}
            </span>
            {/* Duration + cost + time */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: 2,
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontFamily: "Space Grotesk, sans-serif",
                  fontSize: 11,
                  color: "var(--cv4-text-muted)",
                }}
              >
                {formatDuration(item.duration_ms)}
                {item.total_cost != null && ` · ¥${item.total_cost}`}
              </span>
              <span
                style={{
                  fontFamily: "Space Grotesk, sans-serif",
                  fontSize: 11,
                  color: "var(--cv4-text-disabled)",
                }}
              >
                {relativeTime(item.queued_at)}
              </span>
            </div>
          </div>
        ))}
    </div>
  );
}
