"use client";

import { useEffect, useState, useCallback } from "react";
import { X, Loader2, Check } from "lucide-react";

interface BatchExecutionBarProps {
  selectedCount: number;
  batchState: "idle" | "executing" | "complete";
  completedCount: number;
  totalCount: number;
  onExecute: () => void;
  onDismiss: () => void;
}

export function BatchExecutionBar({
  selectedCount,
  batchState,
  completedCount,
  totalCount,
  onExecute,
  onDismiss,
}: BatchExecutionBarProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (batchState !== "complete") return;
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 150);
    }, 2000);
    return () => clearTimeout(timer);
  }, [batchState, onDismiss]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    setTimeout(onDismiss, 150);
  }, [onDismiss]);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 24,
        left: "50%",
        transform: `translateX(-50%) translateY(${visible ? "0" : "100%"})`,
        transition: visible
          ? "transform 200ms ease-out"
          : "transform 150ms ease-in",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 16px",
        height: 44,
        background: "var(--cv4-surface-popup)",
        borderRadius: "var(--cv4-radius-menu)",
        border: "1px solid var(--cv4-border-default)",
        boxShadow: "var(--cv4-shadow-lg)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        zIndex: 50,
        whiteSpace: "nowrap",
      }}
    >
      {batchState === "idle" && (
        <>
          <span
            style={{
              fontSize: 13,
              fontFamily: "Manrope, sans-serif",
              color: "var(--cv4-text-secondary)",
            }}
          >
            已选择 {selectedCount} 个节点
          </span>
          <button
            onClick={onExecute}
            style={{
              padding: "6px 16px",
              borderRadius: 8,
              border: "none",
              background: "var(--cv4-btn-primary)",
              color: "var(--cv4-btn-primary-text)",
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "'Space Grotesk', sans-serif",
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            执行选中
          </button>
          <button
            onClick={handleDismiss}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 24,
              height: 24,
              borderRadius: 6,
              border: "none",
              background: "transparent",
              color: "var(--cv4-text-muted)",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <X size={14} />
          </button>
        </>
      )}

      {batchState === "executing" && (
        <>
          <Loader2
            size={16}
            style={{
              color: "var(--cv5-status-running)",
              animation: "spin 1s linear infinite",
            }}
          />
          <span
            style={{
              fontSize: 13,
              fontFamily: "Manrope, sans-serif",
              color: "var(--cv4-text-secondary)",
            }}
          >
            执行中 {completedCount}/{totalCount}
          </span>
        </>
      )}

      {batchState === "complete" && (
        <>
          <Check
            size={16}
            style={{ color: "var(--cv5-status-success)" }}
          />
          <span
            style={{
              fontSize: 13,
              fontFamily: "Manrope, sans-serif",
              color: "var(--cv5-status-success)",
            }}
          >
            已完成
          </span>
        </>
      )}
    </div>
  );
}
