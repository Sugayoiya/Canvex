"use client";

import { usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { Search, Bell, Home } from "lucide-react";

const SEGMENT_LABELS: Record<string, string> = {
  projects: "Projects",
  teams: "Team & Roles",
  settings: "Settings",
  ai: "AI Console",
  billing: "Billing",
  tasks: "Task Monitor",
};

export function Topbar() {
  const pathname = usePathname();
  const { user } = useAuthStore();

  const segments = (pathname ?? "")
    .split("/")
    .filter(Boolean)
    .map((seg) => SEGMENT_LABELS[seg] ?? seg);

  const initial = user?.nickname?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "U";

  return (
    <header
      style={{
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        background: "var(--ob-surface-low)",
        borderBottom: "1px solid var(--ob-glass-border)",
        flexShrink: 0,
      }}
    >
      {/* Breadcrumbs */}
      <nav style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Home size={14} style={{ color: "var(--ob-text-muted)" }} />
        {segments.map((label, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "var(--ob-text-muted)", fontSize: 12 }}>›</span>
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 13,
                color: i === segments.length - 1 ? "var(--ob-text-primary)" : "var(--ob-text-muted)",
                fontWeight: i === segments.length - 1 ? 600 : 400,
              }}
            >
              {label}
            </span>
          </span>
        ))}
      </nav>

      {/* Right section */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ position: "relative" }}>
          <Search
            size={14}
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--ob-text-muted)",
              pointerEvents: "none",
            }}
          />
          <input
            type="text"
            placeholder="Search..."
            style={{
              width: 200,
              padding: "6px 10px 6px 30px",
              background: "var(--ob-surface-high)",
              border: "1px solid var(--ob-glass-border)",
              borderRadius: 6,
              fontSize: 12,
              fontFamily: "var(--font-body)",
              color: "var(--ob-text-primary)",
              outline: "none",
            }}
          />
        </div>
        <button
          type="button"
          style={{
            background: "none",
            border: "none",
            padding: 6,
            cursor: "pointer",
            color: "var(--ob-text-muted)",
            display: "flex",
            alignItems: "center",
          }}
        >
          <Bell size={16} />
        </button>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "var(--ob-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-headline)",
            fontSize: 13,
            fontWeight: 700,
            color: "var(--ob-text-on-primary)",
          }}
        >
          {initial}
        </div>
      </div>
    </header>
  );
}
