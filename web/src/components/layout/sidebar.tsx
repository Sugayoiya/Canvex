"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ListTodo, FolderOpen, type LucideIcon } from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { label: "项目", href: "/projects", icon: FolderOpen },
  { label: "任务监控", href: "/tasks", icon: ListTodo },
  { label: "计费", href: "/billing", icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: 200,
        minHeight: "100vh",
        borderRight: "1px solid var(--cv4-border-subtle, #e5e7eb)",
        background: "var(--cv4-surface-primary, #fff)",
        padding: "16px 8px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          padding: "8px 12px 16px",
          fontFamily: "Space Grotesk, sans-serif",
          fontSize: 15,
          fontWeight: 700,
          color: "var(--cv4-text-primary)",
          background:
            "linear-gradient(90deg, #6366f1, #a855f7)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        Canvas Studio
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || pathname?.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px",
                borderRadius: 8,
                textDecoration: "none",
                fontFamily: "Manrope, sans-serif",
                fontSize: 13,
                fontWeight: isActive ? 700 : 400,
                color: isActive
                  ? "var(--cv4-text-primary)"
                  : "var(--cv4-text-muted)",
                background: isActive
                  ? "var(--cv4-hover-highlight, rgba(0,0,0,0.04))"
                  : "transparent",
                transition: "background 100ms, color 100ms",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background =
                    "var(--cv4-hover-highlight, rgba(0,0,0,0.04))";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
