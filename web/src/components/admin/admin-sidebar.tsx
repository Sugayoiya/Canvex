"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Shield,
  LayoutDashboard,
  Users,
  Group,
  Gauge,
  CreditCard,
  Settings,
  Activity,
  type LucideIcon,
} from "lucide-react";

interface AdminNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
}

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard, exact: true },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Teams", href: "/admin/teams", icon: Group },
  { label: "Quotas", href: "/admin/quotas", icon: Gauge },
  { label: "Pricing", href: "/admin/pricing", icon: CreditCard },
  { label: "Providers", href: "/admin/providers", icon: Settings },
  { label: "Monitoring", href: "/admin/monitoring", icon: Activity },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: 240,
        minHeight: "100vh",
        background: "var(--cv4-canvas-bg)",
        borderRight: "1px solid var(--cv4-border-default)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        padding: "24px 16px 16px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
        <Shield size={20} style={{ color: "var(--cv4-text-primary)" }} />
        <div>
          <div
            style={{
              fontFamily: "var(--font-headline)",
              fontSize: 14,
              fontWeight: 700,
              color: "var(--cv4-text-primary)",
              lineHeight: 1.3,
            }}
          >
            Admin
          </div>
          <div
            style={{
              fontFamily: "var(--font-headline)",
              fontSize: 12,
              fontWeight: 400,
              color: "var(--cv4-text-muted)",
              lineHeight: 1.3,
              letterSpacing: "1px",
            }}
          >
            Production Suite
          </div>
        </div>
      </div>

      <nav aria-label="Admin navigation" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {ADMIN_NAV_ITEMS.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                height: 36,
                padding: "0 12px",
                borderRadius: 8,
                textDecoration: "none",
                fontFamily: "var(--font-body)",
                fontSize: 12,
                fontWeight: isActive ? 700 : 400,
                color: isActive ? "var(--cv4-text-primary)" : "var(--cv4-text-muted)",
                background: isActive ? "var(--cv4-active-highlight)" : "transparent",
                transition: "background 100ms, color 100ms",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "var(--cv4-hover-highlight)";
                  e.currentTarget.style.color = "var(--cv4-text-secondary)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--cv4-text-muted)";
                }
              }}
            >
              <item.icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
