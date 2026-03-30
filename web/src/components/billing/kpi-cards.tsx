"use client";

import { DollarSign, Activity, Zap } from "lucide-react";
import type { ReactNode } from "react";

interface KPICardsProps {
  totalCost: number;
  totalCalls: number;
  totalTokens: number;
}

function formatCost(n: number): string {
  return `¥${n.toFixed(2)}`;
}

function formatCount(n: number): string {
  return n.toLocaleString();
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function KPICard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        background: "var(--cv4-surface-primary)",
        border: "1px solid var(--cv4-border-default)",
        borderRadius: 12,
        padding: "20px 24px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <span style={{ color: "var(--cv4-text-muted)" }}>{icon}</span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 400,
            fontFamily: "Manrope, sans-serif",
            color: "var(--cv4-text-muted)",
            lineHeight: 1.4,
          }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          fontFamily: "'Space Grotesk', sans-serif",
          color: "var(--cv4-text-primary)",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

export function KPICards({ totalCost, totalCalls, totalTokens }: KPICardsProps) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
      <KPICard
        icon={<DollarSign size={16} />}
        label="本月总花费"
        value={formatCost(totalCost)}
      />
      <KPICard
        icon={<Activity size={16} />}
        label="总调用量"
        value={formatCount(totalCalls)}
      />
      <KPICard
        icon={<Zap size={16} />}
        label="总 Token 用量"
        value={formatTokens(totalTokens)}
      />
    </div>
  );
}
