"use client";

interface StatusBadgeProps {
  status: "active" | "banned";
}

const VARIANTS = {
  active: { bg: "#4CAF5020", color: "var(--ob-success)" },
  banned: { bg: "#FFB4AB20", color: "var(--ob-error)" },
} as const;

export function StatusBadge({ status }: StatusBadgeProps) {
  const v = VARIANTS[status];
  return (
    <span
      aria-label={`Status: ${status === "active" ? "Active" : "Banned"}`}
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
      {status === "active" ? "Active" : "Banned"}
    </span>
  );
}
