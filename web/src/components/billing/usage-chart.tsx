"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface UsageChartProps {
  data: Array<{ period: string; calls: number; cost: number; tokens: number }>;
  granularity: "hour" | "day" | "week";
  onGranularityChange: (g: "hour" | "day" | "week") => void;
}

const granularityOptions: { key: "hour" | "day" | "week"; label: string }[] = [
  { key: "hour", label: "按小时" },
  { key: "day", label: "按天" },
  { key: "week", label: "按周" },
];

export function UsageChart({
  data,
  granularity,
  onGranularityChange,
}: UsageChartProps) {
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
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            fontFamily: "'Space Grotesk', sans-serif",
            color: "var(--cv4-text-primary)",
            lineHeight: 1.3,
          }}
        >
          使用趋势
        </span>
        <div
          style={{
            display: "flex",
            background: "var(--cv4-surface-secondary)",
            borderRadius: 6,
            padding: 2,
          }}
        >
          {granularityOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => onGranularityChange(opt.key)}
              style={{
                padding: "4px 10px",
                borderRadius: 4,
                border: "none",
                background:
                  granularity === opt.key
                    ? "var(--cv4-surface-primary)"
                    : "transparent",
                color:
                  granularity === opt.key
                    ? "var(--cv4-text-primary)"
                    : "var(--cv4-text-muted)",
                fontSize: 11,
                fontFamily: "Manrope, sans-serif",
                fontWeight: granularity === opt.key ? 700 : 400,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
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
          暂无趋势数据
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data}>
            <CartesianGrid
              stroke="var(--cv5-chart-grid)"
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="period"
              tick={{
                fontSize: 11,
                fontFamily: "Manrope",
                fill: "var(--cv4-text-disabled)",
              }}
            />
            <YAxis
              tick={{
                fontSize: 11,
                fontFamily: "Manrope",
                fill: "var(--cv4-text-disabled)",
              }}
            />
            <Tooltip
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
            <Line
              type="monotone"
              dataKey="cost"
              stroke="var(--cv5-chart-series-1)"
              strokeWidth={2}
              dot={false}
              name="费用"
            />
            <Line
              type="monotone"
              dataKey="calls"
              stroke="var(--cv5-chart-series-2)"
              strokeWidth={2}
              dot={false}
              name="调用量"
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
