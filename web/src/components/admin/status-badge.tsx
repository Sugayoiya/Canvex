"use client";

interface StatusBadgeProps {
  status:
    | "active"
    | "banned"
    | "running"
    | "completed"
    | "failed"
    | "timeout"
    | "queued"
    | "success";
}

const VARIANTS: Record<
  StatusBadgeProps["status"],
  { bg: string; color: string; label: string }
> = {
  active: { bg: "#4CAF5020", color: "var(--ob-success)", label: "Active" },
  banned: { bg: "#FFB4AB20", color: "var(--ob-error)", label: "Banned" },
  running: { bg: "#007AFF20", color: "#007AFF", label: "Running" },
  completed: { bg: "#4CAF5020", color: "var(--ob-success)", label: "Completed" },
  failed: { bg: "#FFB4AB20", color: "var(--ob-error)", label: "Failed" },
  timeout: { bg: "#FF950020", color: "#FF9500", label: "Timeout" },
  queued: { bg: "#8E8E9320", color: "#8E8E93", label: "Queued" },
  success: { bg: "#4CAF5020", color: "var(--ob-success)", label: "Success" },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const v = VARIANTS[status];
  return (
    <span
      aria-label={`Status: ${v.label}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 24,
        padding: "4px 8px",
        borderRadius: 6,
        background: v.bg,
        color: v.color,
        fontFamily: "Manrope, sans-serif",
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1.5,
        whiteSpace: "nowrap",
      }}
    >
      {v.label}
    </span>
  );
}
