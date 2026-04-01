"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FolderOpen,
  Users,
  Bot,
  ListTodo,
  BarChart3,
  ChevronDown,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { useAuthStore, type Team } from "@/stores/auth-store";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Projects", href: "/projects", icon: FolderOpen },
  { label: "Team & Roles", href: "/teams", icon: Users },
  { label: "AI Console", href: "/settings/ai", icon: Bot },
];

const BOTTOM_ITEMS: NavItem[] = [
  { label: "Tasks", href: "/tasks", icon: ListTodo },
  { label: "Billing", href: "/billing", icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, teams, currentSpace, switchSpace } = useAuthStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const spaceName =
    currentSpace.type === "team" ? currentSpace.teamName : user?.nickname || "Personal";
  const spaceLabel = currentSpace.type === "team" ? "TEAM SPACE" : "PERSONAL";

  const spaceInitial =
    currentSpace.type === "team"
      ? currentSpace.teamName?.charAt(0)?.toUpperCase() || "T"
      : user?.nickname?.charAt(0)?.toUpperCase() || "P";

  const handleSwitchSpace = (team?: Team) => {
    if (team) {
      switchSpace({ type: "team", teamId: team.id, teamName: team.name });
    } else {
      switchSpace({ type: "personal" });
    }
    setDropdownOpen(false);
  };

  const renderNavLink = (item: NavItem) => {
    const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
    return (
      <Link
        key={item.href}
        href={item.href}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "7px 12px",
          borderRadius: 8,
          textDecoration: "none",
          fontFamily: "var(--font-body)",
          fontSize: 13,
          fontWeight: isActive ? 700 : 400,
          color: isActive ? "var(--ob-text-primary)" : "var(--ob-text-muted)",
          background: isActive ? "var(--ob-surface-high)" : "transparent",
          transition: "background 100ms, color 100ms",
        }}
        onMouseEnter={(e) => {
          if (!isActive) e.currentTarget.style.background = "var(--ob-surface-high)";
        }}
        onMouseLeave={(e) => {
          if (!isActive) e.currentTarget.style.background = "transparent";
        }}
      >
        <item.icon size={16} />
        {item.label}
      </Link>
    );
  };

  return (
    <aside
      style={{
        width: 180,
        minHeight: "100vh",
        background: "var(--ob-surface-low)",
        borderRight: "1px solid var(--ob-glass-border)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        padding: "12px 8px",
      }}
    >
      {/* Space identity */}
      <div style={{ position: "relative", marginBottom: 12 }}>
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 12px",
            borderRadius: 8,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            transition: "background 100ms",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--ob-surface-high)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "var(--ob-surface-high)",
              border: "1px solid var(--ob-glass-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-headline)",
              fontSize: 14,
              fontWeight: 700,
              color: "var(--ob-text-primary)",
              flexShrink: 0,
            }}
          >
            {spaceInitial}
          </div>
          <div style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--ob-text-primary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {spaceName}
            </div>
            <div
              style={{
                fontFamily: "var(--font-headline)",
                fontSize: 9,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                color: "var(--ob-text-muted)",
              }}
            >
              {spaceLabel}
            </div>
          </div>
          <ChevronDown
            size={14}
            style={{
              color: "var(--ob-text-muted)",
              flexShrink: 0,
              transform: dropdownOpen ? "rotate(180deg)" : "rotate(0)",
              transition: "transform 150ms",
            }}
          />
        </button>

        {/* Space dropdown */}
        {dropdownOpen && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 8,
              right: 8,
              background: "var(--ob-surface-highest)",
              border: "1px solid var(--ob-glass-border)",
              borderRadius: 8,
              padding: 4,
              zIndex: 50,
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            }}
          >
            <button
              type="button"
              onClick={() => handleSwitchSpace()}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                borderRadius: 6,
                background: currentSpace.type === "personal" ? "var(--ob-surface-high)" : "transparent",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
                fontSize: 12,
                color: "var(--ob-text-primary)",
                transition: "background 100ms",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--ob-surface-high)"; }}
              onMouseLeave={(e) => {
                if (currentSpace.type !== "personal") e.currentTarget.style.background = "transparent";
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  background: "var(--ob-surface-mid)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--ob-text-secondary)",
                }}
              >
                {user?.nickname?.charAt(0)?.toUpperCase() || "P"}
              </div>
              Personal
            </button>
            {teams.map((team) => (
              <button
                key={team.id}
                type="button"
                onClick={() => handleSwitchSpace(team)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 10px",
                  borderRadius: 6,
                  background:
                    currentSpace.type === "team" && currentSpace.teamId === team.id
                      ? "var(--ob-surface-high)"
                      : "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                  fontSize: 12,
                  color: "var(--ob-text-primary)",
                  transition: "background 100ms",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--ob-surface-high)"; }}
                onMouseLeave={(e) => {
                  if (!(currentSpace.type === "team" && currentSpace.teamId === team.id)) {
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: "var(--ob-surface-mid)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--ob-text-secondary)",
                  }}
                >
                  {team.name.charAt(0).toUpperCase()}
                </div>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {team.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "var(--ob-glass-border)", margin: "0 12px 8px" }} />

      {/* Main nav */}
      <div
        style={{
          fontFamily: "var(--font-headline)",
          fontSize: 9,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.2em",
          color: "var(--ob-text-muted)",
          padding: "12px 12px 4px",
        }}
      >
        WORKSPACE
      </div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
        {NAV_ITEMS.map(renderNavLink)}

        <div style={{ flex: 1 }} />

        {/* Divider */}
        <div style={{ height: 1, background: "var(--ob-glass-border)", margin: "8px 12px" }} />

        {BOTTOM_ITEMS.map(renderNavLink)}

        {user?.is_admin && (
          <>
            <div style={{ height: 1, background: "var(--ob-glass-border)", margin: "8px 12px" }} />
            <Link
              href="/admin"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "7px 12px",
                borderRadius: 8,
                textDecoration: "none",
                fontFamily: "var(--font-body)",
                fontSize: 13,
                fontWeight: pathname?.startsWith("/admin") ? 700 : 400,
                color: pathname?.startsWith("/admin") ? "var(--ob-text-primary)" : "var(--ob-text-muted)",
                background: pathname?.startsWith("/admin") ? "var(--ob-surface-high)" : "transparent",
                transition: "background 100ms, color 100ms",
              }}
              onMouseEnter={(e) => {
                if (!pathname?.startsWith("/admin")) e.currentTarget.style.background = "var(--ob-surface-high)";
              }}
              onMouseLeave={(e) => {
                if (!pathname?.startsWith("/admin")) e.currentTarget.style.background = "transparent";
              }}
            >
              <Shield size={16} />
              Admin Console
            </Link>
          </>
        )}
      </nav>
    </aside>
  );
}
