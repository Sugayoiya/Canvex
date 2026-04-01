"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Bell } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";

export function AdminTopbar() {
  const router = useRouter();
  const { user } = useAuthStore();

  const initial =
    user?.nickname?.charAt(0)?.toUpperCase() ||
    user?.email?.charAt(0)?.toUpperCase() ||
    "A";

  return (
    <header
      style={{
        height: 48,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 32px",
        background: "var(--cv4-surface-overlay)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid var(--cv4-border-default)",
        flexShrink: 0,
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <button
          type="button"
          onClick={() => router.push("/projects")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            color: "var(--cv4-text-muted)",
            transition: "color 100ms",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--cv4-text-secondary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--cv4-text-muted)";
          }}
        >
          <ArrowLeft size={14} />
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 12,
              fontWeight: 400,
              lineHeight: 1.5,
            }}
          >
            Back to App
          </span>
        </button>
        <span
          style={{
            fontFamily: "var(--font-headline)",
            fontSize: 14,
            fontWeight: 700,
            color: "var(--cv4-text-primary)",
            lineHeight: 1.3,
          }}
        >
          Admin Console
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <button
          type="button"
          aria-label="Notifications"
          style={{
            background: "none",
            border: "none",
            padding: 4,
            cursor: "pointer",
            color: "var(--cv4-text-muted)",
            display: "flex",
            alignItems: "center",
          }}
        >
          <Bell size={16} />
        </button>
        <div style={{ width: 1, height: 20, background: "var(--cv4-border-divider)" }} />
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 12,
            fontWeight: 400,
            color: "var(--cv4-text-secondary)",
            lineHeight: 1.5,
          }}
        >
          {user?.email || "admin@canvex.io"}
        </span>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 9999,
            background: "var(--cv4-surface-primary)",
            border: "1px solid var(--cv4-border-default)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-headline)",
            fontSize: 12,
            fontWeight: 700,
            color: "var(--cv4-text-primary)",
          }}
        >
          {initial}
        </div>
      </div>
    </header>
  );
}
