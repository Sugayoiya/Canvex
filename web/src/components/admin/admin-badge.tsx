"use client";

interface AdminBadgeProps {
  isAdmin: boolean;
}

export function AdminBadge({ isAdmin }: AdminBadgeProps) {
  if (!isAdmin) return null;

  return (
    <span
      aria-label="Role: Admin"
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 24,
        padding: "4px 8px",
        borderRadius: 6,
        background: "#BB86FC20",
        color: "#BB86FC",
        fontFamily: "Manrope, sans-serif",
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1.5,
        whiteSpace: "nowrap",
      }}
    >
      Admin
    </span>
  );
}
