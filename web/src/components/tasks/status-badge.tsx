"use client";

const STATUS_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  running: { bg: "#007AFF20", color: "var(--cv5-status-running)", label: "运行中" },
  queued: { bg: "#8E8E9320", color: "var(--cv5-status-queued)", label: "排队中" },
  completed: { bg: "#34C75920", color: "var(--cv5-status-success)", label: "已完成" },
  failed: { bg: "#FF3B3020", color: "var(--cv5-status-failed)", label: "失败" },
  timeout: { bg: "#FF950020", color: "var(--cv5-status-blocked)", label: "超时" },
  blocked: { bg: "#FF950020", color: "var(--cv5-status-blocked)", label: "已阻塞" },
};

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.queued;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 8px",
        borderRadius: 6,
        background: config.bg,
        color: config.color,
        fontFamily: "Space Grotesk, sans-serif",
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {status === "running" && (
        <span
          className="animate-pulse"
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: config.color,
          }}
        />
      )}
      {config.label}
    </span>
  );
}
