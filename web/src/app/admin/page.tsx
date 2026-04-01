"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { User, Users, CircleCheck, Wallet, Activity, AlertTriangle, RefreshCw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { adminApi } from "@/lib/api";

interface DashboardWindowStats {
  tasks_total: number;
  tasks_failed: number;
  cost_total: number;
}

interface ProviderStatus {
  enabled_count: number;
  disabled_count: number;
}

interface DashboardData {
  total_users: number;
  total_teams: number;
  active_tasks: number;
  total_cost: number;
  provider_status: ProviderStatus;
  windows: Record<string, DashboardWindowStats>;
}

type WindowKey = "h24" | "d7" | "d30";

interface AlertsData {
  quota_warning_users: number;
  failed_tasks_24h: number;
  error_providers: number;
}

const WINDOW_LABELS: Record<WindowKey, string> = {
  h24: "24h",
  d7: "7d",
  d30: "30d",
};

function formatCost(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value > 0) return `$${value.toFixed(4)}`;
  return "$0.00";
}

function KpiCard({
  label,
  icon: Icon,
  value,
  badge,
  description,
  badgeVariant = "default",
  isLoading,
  onClick,
  alertBadge,
}: {
  label: string;
  icon: LucideIcon;
  value: string;
  badge: string | null;
  description: string;
  badgeVariant?: "default" | "primary" | "success" | "warning";
  isLoading?: boolean;
  onClick?: () => void;
  alertBadge?: string | null;
}) {
  const [hovered, setHovered] = useState(false);

  const badgeColors: Record<string, { bg: string; text: string; border: string }> = {
    default: { bg: "var(--cv4-surface-primary)", text: "var(--cv4-text-muted)", border: "var(--cv4-border-subtle)" },
    primary: { bg: "var(--cv4-surface-primary)", text: "var(--cv4-text-primary)", border: "var(--cv4-border-subtle)" },
    success: { bg: "#4CAF5015", text: "#4CAF50", border: "#4CAF5030" },
    warning: { bg: "#FFB4AB15", text: "#FFB4AB", border: "#FFB4AB30" },
  };
  const bc = badgeColors[badgeVariant];

  return (
    <div
      onClick={onClick}
      onKeyDown={(e) => { if (onClick && e.key === "Enter") onClick(); }}
      role={onClick ? "link" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onMouseEnter={() => onClick && setHovered(true)}
      onMouseLeave={() => onClick && setHovered(false)}
      style={{
        height: 160,
        padding: 24,
        borderRadius: 12,
        background: "var(--cv4-surface-primary)",
        border: `1px solid ${hovered ? "rgba(0,209,255,0.3)" : "var(--cv4-border-subtle)"}`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        cursor: onClick ? "pointer" : "default",
        transition: "all 150ms ease",
        transform: hovered ? "translateY(-1px)" : "none",
        outline: "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span
          style={{
            fontFamily: "var(--font-headline)",
            fontSize: 12,
            fontWeight: 400,
            color: "var(--cv4-text-muted)",
            lineHeight: 1.3,
            letterSpacing: "1px",
          }}
        >
          {label}
        </span>
        <Icon size={16} style={{ color: "var(--cv4-text-muted)" }} />
      </div>
      <div>
        {isLoading ? (
          <div
            style={{
              width: 80,
              height: 36,
              borderRadius: 8,
              background: "var(--cv4-text-muted)",
              opacity: 0.15,
              animation: "dashPulse 1.5s infinite",
            }}
          />
        ) : (
          <div
            style={{
              fontFamily: "var(--font-headline)",
              fontSize: 36,
              fontWeight: 700,
              color: "var(--cv4-text-primary)",
              lineHeight: 1.1,
            }}
          >
            {value}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          {badge && (
            <span
              style={{
                fontFamily: "var(--font-headline)",
                fontSize: 12,
                fontWeight: 400,
                lineHeight: 1.3,
                padding: "2px 8px",
                borderRadius: 6,
                background: bc.bg,
                border: `1px solid ${bc.border}`,
                color: bc.text,
              }}
            >
              {badge}
            </span>
          )}
          {alertBadge && (
            <span
              style={{
                fontFamily: "var(--font-headline)",
                fontSize: 12,
                fontWeight: 400,
                lineHeight: 1.3,
                padding: "2px 8px",
                borderRadius: 6,
                background: "#FFB4AB15",
                border: "1px solid #FFB4AB30",
                color: "#FFB4AB",
              }}
            >
              {alertBadge}
            </span>
          )}
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 12,
              fontWeight: 400,
              color: "var(--cv4-text-muted)",
              lineHeight: 1.5,
            }}
          >
            {description}
          </span>
        </div>
      </div>
    </div>
  );
}

function WindowToggle({
  activeWindow,
  onChange,
}: {
  activeWindow: WindowKey;
  onChange: (w: WindowKey) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 4, background: "var(--cv4-canvas-bg)", borderRadius: 8, padding: 2 }}>
      {(Object.keys(WINDOW_LABELS) as WindowKey[]).map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          style={{
            height: 28,
            padding: "0 12px",
            borderRadius: 6,
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--font-body)",
            fontSize: 12,
            fontWeight: activeWindow === key ? 700 : 400,
            background: activeWindow === key ? "var(--cv4-surface-primary)" : "transparent",
            color: activeWindow === key ? "var(--cv4-text-primary)" : "var(--cv4-text-muted)",
            transition: "all 150ms",
          }}
        >
          {WINDOW_LABELS[key]}
        </button>
      ))}
    </div>
  );
}

export default function AdminDashboardPage() {
  const [activeWindow, setActiveWindow] = useState<WindowKey>("h24");
  const router = useRouter();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: () => adminApi.getDashboard().then((r) => r.data as DashboardData),
    refetchInterval: 60_000,
  });

  const alertsQuery = useQuery({
    queryKey: ["admin", "alerts"],
    queryFn: () => adminApi.getAlerts().then((r) => r.data as AlertsData),
    refetchInterval: 60_000,
  });
  const alerts = alertsQuery.data;

  const win = data?.windows?.[activeWindow];
  const providers = data?.provider_status;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <style>{`@keyframes dashPulse { 0%,100% { opacity: 0.15 } 50% { opacity: 0.3 } }`}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1
            style={{
              fontFamily: "var(--font-headline)",
              fontSize: 24,
              fontWeight: 700,
              color: "var(--cv4-text-primary)",
              lineHeight: 1.2,
              margin: 0,
              letterSpacing: "-0.5px",
            }}
          >
            Dashboard
          </h1>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 14,
              fontWeight: 400,
              color: "var(--cv4-text-muted)",
              lineHeight: 1.5,
              margin: "4px 0 0",
            }}
          >
            System overview and key metrics
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          style={{
            height: 36,
            padding: "0 16px",
            borderRadius: 8,
            background: "var(--cv4-btn-secondary)",
            color: "var(--cv4-btn-secondary-text)",
            border: "1px solid var(--cv4-btn-secondary-border)",
            fontFamily: "var(--font-body)",
            fontSize: 12,
            fontWeight: 400,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {isError && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            background: "#FFB4AB10",
            border: "1px solid #FFB4AB20",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <AlertTriangle size={14} style={{ color: "var(--ob-error)" }} />
          <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--ob-error)" }}>
            Failed to load dashboard data.
          </span>
          <button
            type="button"
            onClick={() => refetch()}
            style={{
              marginLeft: "auto",
              height: 28,
              padding: "0 12px",
              borderRadius: 6,
              border: "none",
              background: "var(--cv4-btn-primary)",
              color: "var(--cv4-btn-primary-text)",
              fontFamily: "var(--font-body)",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <KpiCard
          label="TOTAL USERS"
          icon={User}
          value={data ? String(data.total_users) : "—"}
          badge={data ? `${data.total_users > 0 ? "Active" : "No users"}` : null}
          description={data ? `${data.total_users} registered accounts` : "Loading..."}
          badgeVariant="success"
          isLoading={isLoading}
          onClick={() => router.push("/admin/users")}
          alertBadge={alerts && alerts.quota_warning_users > 0
            ? `${alerts.quota_warning_users} at quota limit` : null}
        />
        <KpiCard
          label="ACTIVE TEAMS"
          icon={Users}
          value={data ? String(data.total_teams) : "—"}
          badge={data ? `${data.total_teams} teams` : null}
          description={data ? `Team collaboration spaces` : "Loading..."}
          isLoading={isLoading}
          onClick={() => router.push("/admin/teams")}
        />
        <KpiCard
          label="ACTIVE TASKS"
          icon={CircleCheck}
          value={data ? String(data.active_tasks) : "—"}
          badge={data?.active_tasks === 0 ? "Idle" : data ? `${data.active_tasks} running` : null}
          description={data ? "Queued or running tasks" : "Loading..."}
          badgeVariant={data && data.active_tasks > 0 ? "warning" : "default"}
          isLoading={isLoading}
          onClick={() => router.push("/admin/monitoring")}
          alertBadge={alerts && alerts.failed_tasks_24h > 0
            ? `${alerts.failed_tasks_24h} failed in 24h` : null}
        />
        <KpiCard
          label="TOTAL COST"
          icon={Wallet}
          value={data ? formatCost(data.total_cost) : "—"}
          badge={data ? formatCost(data.total_cost) : null}
          description={data ? "All-time AI usage cost" : "Loading..."}
          badgeVariant="primary"
          isLoading={isLoading}
          onClick={() => router.push("/admin/monitoring")}
        />
      </div>

      {/* Time-window stats */}
      <div
        style={{
          borderTop: "1px solid var(--cv4-border-subtle)",
          paddingTop: 24,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span
            style={{
              fontFamily: "var(--font-headline)",
              fontSize: 14,
              fontWeight: 700,
              color: "var(--cv4-text-primary)",
            }}
          >
            Activity Overview
          </span>
          <WindowToggle activeWindow={activeWindow} onChange={setActiveWindow} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <StatCard
            label="Tasks"
            icon={Activity}
            value={win ? String(win.tasks_total) : "—"}
            subtitle={`in ${WINDOW_LABELS[activeWindow]}`}
            isLoading={isLoading}
          />
          <StatCard
            label="Failed"
            icon={AlertTriangle}
            value={win ? String(win.tasks_failed) : "—"}
            subtitle={win && win.tasks_total > 0
              ? `${((win.tasks_failed / win.tasks_total) * 100).toFixed(1)}% failure rate`
              : "No failures"}
            variant={win && win.tasks_failed > 0 ? "warning" : "default"}
            isLoading={isLoading}
          />
          <StatCard
            label="Cost"
            icon={Wallet}
            value={win ? formatCost(win.cost_total) : "—"}
            subtitle={`spent in ${WINDOW_LABELS[activeWindow]}`}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Provider status */}
      <div
        style={{
          borderTop: "1px solid var(--cv4-border-subtle)",
          paddingTop: 24,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-headline)",
            fontSize: 14,
            fontWeight: 700,
            color: "var(--cv4-text-primary)",
          }}
        >
          AI Providers
        </span>
        <div style={{ display: "flex", gap: 12 }}>
          <div
            style={{
              flex: 1,
              padding: "16px 20px",
              borderRadius: 10,
              background: "var(--cv4-surface-primary)",
              border: "1px solid var(--cv4-border-subtle)",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: 4, background: "#4CAF50" }} />
            <div>
              <div
                style={{
                  fontFamily: "var(--font-headline)",
                  fontSize: 20,
                  fontWeight: 700,
                  color: "var(--cv4-text-primary)",
                }}
              >
                {isLoading ? "—" : (providers?.enabled_count ?? 0)}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 12,
                  color: "var(--cv4-text-muted)",
                }}
              >
                Enabled
              </div>
            </div>
          </div>
          <div
            style={{
              flex: 1,
              padding: "16px 20px",
              borderRadius: 10,
              background: "var(--cv4-surface-primary)",
              border: "1px solid var(--cv4-border-subtle)",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: 4, background: "var(--cv4-text-muted)", opacity: 0.5 }} />
            <div>
              <div
                style={{
                  fontFamily: "var(--font-headline)",
                  fontSize: 20,
                  fontWeight: 700,
                  color: "var(--cv4-text-primary)",
                }}
              >
                {isLoading ? "—" : (providers?.disabled_count ?? 0)}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 12,
                  color: "var(--cv4-text-muted)",
                }}
              >
                Disabled
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  icon: Icon,
  value,
  subtitle,
  variant = "default",
  isLoading,
}: {
  label: string;
  icon: LucideIcon;
  value: string;
  subtitle: string;
  variant?: "default" | "warning";
  isLoading?: boolean;
}) {
  return (
    <div
      style={{
        padding: "16px 20px",
        borderRadius: 10,
        background: "var(--cv4-surface-primary)",
        border: "1px solid var(--cv4-border-subtle)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Icon
          size={14}
          style={{ color: variant === "warning" ? "var(--ob-error)" : "var(--cv4-text-muted)" }}
        />
        <span
          style={{
            fontFamily: "var(--font-headline)",
            fontSize: 12,
            fontWeight: 400,
            color: "var(--cv4-text-muted)",
            letterSpacing: "0.5px",
          }}
        >
          {label}
        </span>
      </div>
      {isLoading ? (
        <div
          style={{
            width: 48,
            height: 24,
            borderRadius: 6,
            background: "var(--cv4-text-muted)",
            opacity: 0.15,
            animation: "dashPulse 1.5s infinite",
          }}
        />
      ) : (
        <div
          style={{
            fontFamily: "var(--font-headline)",
            fontSize: 24,
            fontWeight: 700,
            color: variant === "warning" ? "var(--ob-error)" : "var(--cv4-text-primary)",
          }}
        >
          {value}
        </div>
      )}
      <span
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 11,
          color: "var(--cv4-text-muted)",
        }}
      >
        {subtitle}
      </span>
    </div>
  );
}
