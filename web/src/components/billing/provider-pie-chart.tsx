"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
} from "recharts";

interface ProviderPieChartProps {
  data: Array<{ provider: string; total_cost: number }>;
}

const KNOWN_PROVIDER_COLORS: Record<string, string> = {
  gemini: "#4285F4",
  openai: "#10A37F",
  deepseek: "#6366F1",
  comfyui: "#F59E0B",
};

const FALLBACK_PALETTE = [
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#84CC16",
  "#F97316",
];

function getProviderColor(provider: string, index: number): string {
  const key = provider.toLowerCase();
  if (KNOWN_PROVIDER_COLORS[key]) return KNOWN_PROVIDER_COLORS[key];
  return FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
}

function formatCost(n: number): string {
  return `¥${n.toFixed(2)}`;
}

export function ProviderPieChart({ data }: ProviderPieChartProps) {
  const aggregated = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of data) {
      map.set(
        row.provider,
        (map.get(row.provider) ?? 0) + Number(row.total_cost),
      );
    }
    return Array.from(map.entries())
      .map(([provider, cost]) => ({ provider, cost }))
      .sort((a, b) => b.cost - a.cost);
  }, [data]);

  const totalCost = useMemo(
    () => aggregated.reduce((sum, r) => sum + r.cost, 0),
    [aggregated],
  );

  return (
    <div
      style={{
        background: "var(--cv4-surface-primary)",
        border: "1px solid var(--cv4-border-default)",
        borderRadius: 12,
        padding: "20px 24px",
      }}
    >
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          fontFamily: "'Space Grotesk', sans-serif",
          color: "var(--cv4-text-primary)",
          lineHeight: 1.3,
          display: "block",
          marginBottom: 16,
        }}
      >
        Provider 分布
      </span>

      {aggregated.length === 0 ? (
        <div
          style={{
            height: 280,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--cv4-text-disabled)",
            fontSize: 13,
          }}
        >
          暂无数据
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={aggregated}
                dataKey="cost"
                nameKey="provider"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
              >
                {aggregated.map((entry, i) => (
                  <Cell
                    key={entry.provider}
                    fill={getProviderColor(entry.provider, i)}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => formatCost(Number(value))}
                contentStyle={{
                  background: "var(--cv5-chart-tooltip-bg)",
                  border: "1px solid var(--cv4-border-default)",
                  borderRadius: 8,
                  boxShadow: "var(--cv4-shadow-md)",
                  fontSize: 13,
                  fontFamily: "Manrope",
                }}
              />
              <Legend
                wrapperStyle={{
                  fontSize: 11,
                  fontFamily: "Manrope",
                  color: "var(--cv4-text-muted)",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              textAlign: "center",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                fontFamily: "'Space Grotesk', sans-serif",
                color: "var(--cv4-text-primary)",
              }}
            >
              {formatCost(totalCost)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
