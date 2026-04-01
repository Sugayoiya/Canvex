"use client";

import { User, Users, CircleCheck, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface KpiCard {
  label: string;
  icon: LucideIcon;
  badge: string | null;
  description: string;
  badgePrimary?: boolean;
}

const KPI_CARDS: KpiCard[] = [
  { label: "TOTAL USERS", icon: User, badge: "Stable", description: "Waiting for data link" },
  { label: "ACTIVE TEAMS", icon: Users, badge: "0 active", description: "No pending requests" },
  { label: "TASKS (24H)", icon: CircleCheck, badge: null, description: "Awaiting system sync" },
  { label: "TOTAL COST", icon: Wallet, badge: "USD 0.00", description: "Current billing cycle", badgePrimary: true },
];

export default function AdminDashboardPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
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
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
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
            }}
          >
            Export Data
          </button>
          <button
            type="button"
            style={{
              height: 36,
              padding: "0 16px",
              borderRadius: 8,
              background: "var(--cv4-btn-primary)",
              color: "var(--cv4-btn-primary-text)",
              border: "none",
              fontFamily: "var(--font-body)",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Generate Report
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {KPI_CARDS.map((card) => (
          <div
            key={card.label}
            style={{
              height: 160,
              padding: 24,
              borderRadius: 12,
              background: "var(--cv4-surface-primary)",
              border: "1px solid var(--cv4-border-subtle)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
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
                {card.label}
              </span>
              <card.icon size={16} style={{ color: "var(--cv4-text-muted)" }} />
            </div>
            <div>
              <div
                style={{
                  fontFamily: "var(--font-headline)",
                  fontSize: 36,
                  fontWeight: 400,
                  color: "var(--cv4-text-primary)",
                  lineHeight: 1.1,
                  opacity: 0.5,
                }}
              >
                —
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                {card.badge && (
                  <span
                    style={{
                      fontFamily: "var(--font-headline)",
                      fontSize: 12,
                      fontWeight: 400,
                      lineHeight: 1.3,
                      padding: "2px 8px",
                      borderRadius: 6,
                      background: "var(--cv4-surface-primary)",
                      border: "1px solid var(--cv4-border-subtle)",
                      color: card.badgePrimary ? "var(--cv4-text-primary)" : "var(--cv4-text-muted)",
                    }}
                  >
                    {card.badge}
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
                  {card.description}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          borderTop: "1px solid var(--cv4-border-subtle)",
          paddingTop: 32,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 12px",
            borderRadius: 9999,
            background: "var(--cv4-surface-primary)",
            border: "1px solid var(--cv4-border-subtle)",
            width: "fit-content",
          }}
        >
          <span style={{ width: 5, height: 5, borderRadius: 9999, background: "var(--cv4-text-muted)" }} />
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
            Phase 11: Production Integration
          </span>
        </span>
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 12,
            fontWeight: 400,
            color: "var(--cv4-text-muted)",
            lineHeight: 1.5,
          }}
        >
          Detailed analytics and real-time node monitoring coming in Phase 11
        </span>
      </div>
    </div>
  );
}
