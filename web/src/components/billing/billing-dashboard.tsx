"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { billingApi } from "@/lib/api";
import { KPICards } from "./kpi-cards";
import { RefreshCw } from "lucide-react";

type ViewMode = "global" | "project";
type Granularity = "hour" | "day" | "week";

function toUTCDateString(date: Date): string {
  return date.toISOString().split("T")[0] + "T00:00:00Z";
}

function thirtyDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return toUTCDateString(d);
}

function today(): string {
  return toUTCDateString(new Date());
}

function sevenDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return toUTCDateString(d);
}

function startOfMonth(): string {
  const d = new Date();
  d.setDate(1);
  return toUTCDateString(d);
}

type DatePreset = "7d" | "30d" | "month" | "custom";

const datePresets: { key: DatePreset; label: string }[] = [
  { key: "7d", label: "最近7天" },
  { key: "30d", label: "最近30天" },
  { key: "month", label: "本月" },
  { key: "custom", label: "自定义" },
];

function getPresetRange(preset: DatePreset): { start: string; end: string } {
  switch (preset) {
    case "7d":
      return { start: sevenDaysAgo(), end: today() };
    case "30d":
      return { start: thirtyDaysAgo(), end: today() };
    case "month":
      return { start: startOfMonth(), end: today() };
    default:
      return { start: thirtyDaysAgo(), end: today() };
  }
}

interface UsageStatRow {
  provider: string;
  model: string;
  total_calls: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost: number;
}

export function BillingDashboard() {
  const [viewMode, setViewMode] = useState<ViewMode>("global");
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [datePreset, setDatePreset] = useState<DatePreset>("30d");
  const [dateRange, setDateRange] = useState(getPresetRange("30d"));
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showCustomDates, setShowCustomDates] = useState(false);

  const effectiveProjectId = viewMode === "project" ? selectedProjectId : null;

  const {
    data: statsData,
    isLoading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useQuery<UsageStatRow[]>({
    queryKey: ["billing-stats", dateRange, effectiveProjectId],
    queryFn: () =>
      billingApi
        .usageStats({
          start_date: dateRange.start,
          end_date: dateRange.end,
          project_id: effectiveProjectId ?? undefined,
        })
        .then((r) => r.data),
  });

  const {
    data: timeseriesData,
    isLoading: tsLoading,
  } = useQuery<{ granularity: string; points: Array<{ period: string; calls: number; cost: number; tokens: number }> }>({
    queryKey: ["billing-timeseries", dateRange, granularity, effectiveProjectId],
    queryFn: () =>
      billingApi
        .usageTimeseries({
          start_date: dateRange.start,
          end_date: dateRange.end,
          granularity,
          project_id: effectiveProjectId ?? undefined,
        })
        .then((r) => r.data),
  });

  const { totalCost, totalCalls, totalTokens } = useMemo(() => {
    if (!statsData) return { totalCost: 0, totalCalls: 0, totalTokens: 0 };
    return {
      totalCost: statsData.reduce((sum, r) => sum + Number(r.total_cost), 0),
      totalCalls: statsData.reduce((sum, r) => sum + r.total_calls, 0),
      totalTokens: statsData.reduce(
        (sum, r) => sum + r.total_input_tokens + r.total_output_tokens,
        0,
      ),
    };
  }, [statsData]);

  function handlePreset(preset: DatePreset) {
    setDatePreset(preset);
    if (preset === "custom") {
      setShowCustomDates(true);
      return;
    }
    setShowCustomDates(false);
    setDateRange(getPresetRange(preset));
  }

  if (statsError) {
    return (
      <div
        style={{
          padding: "24px 32px",
          fontFamily: "Manrope, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 400,
            gap: 16,
          }}
        >
          <p
            style={{
              fontSize: 15,
              color: "var(--cv4-text-muted)",
            }}
          >
            数据加载失败，请稍后重试
          </p>
          <button
            onClick={() => refetchStats()}
            style={{
              padding: "8px 20px",
              borderRadius: 8,
              border: "1px solid var(--cv4-border-default)",
              background: "var(--cv4-surface-primary)",
              color: "var(--cv4-text-primary)",
              fontSize: 13,
              fontFamily: "Manrope, sans-serif",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <RefreshCw size={14} />
            重新加载
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "24px 32px",
        fontFamily: "Manrope, sans-serif",
        minHeight: "100vh",
      }}
    >
      {/* Page Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 64,
          marginBottom: 24,
        }}
      >
        <h1
          style={{
            fontSize: 20,
            fontWeight: 700,
            fontFamily: "'Space Grotesk', sans-serif",
            color: "var(--cv4-text-primary)",
            lineHeight: 1.2,
            margin: 0,
          }}
        >
          计费概览
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* View toggle */}
          <div
            style={{
              display: "flex",
              background: "var(--cv4-surface-secondary)",
              borderRadius: 8,
              padding: 2,
            }}
          >
            {(["global", "project"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  padding: "6px 16px",
                  borderRadius: 6,
                  border: "none",
                  background:
                    viewMode === mode
                      ? "var(--cv4-surface-primary)"
                      : "transparent",
                  color:
                    viewMode === mode
                      ? "var(--cv4-text-primary)"
                      : "var(--cv4-text-muted)",
                  fontSize: 13,
                  fontFamily: "Manrope, sans-serif",
                  fontWeight: viewMode === mode ? 700 : 400,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {mode === "global" ? "全局" : "按项目"}
              </button>
            ))}
          </div>

          {/* Date range presets */}
          <div style={{ display: "flex", gap: 4 }}>
            {datePresets.map((p) => (
              <button
                key={p.key}
                onClick={() => handlePreset(p.key)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--cv4-border-default)",
                  background:
                    datePreset === p.key
                      ? "var(--cv4-surface-primary)"
                      : "transparent",
                  color:
                    datePreset === p.key
                      ? "var(--cv4-text-primary)"
                      : "var(--cv4-text-muted)",
                  fontSize: 13,
                  fontFamily: "Manrope, sans-serif",
                  fontWeight: datePreset === p.key ? 700 : 400,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Custom date inputs */}
      {showCustomDates && (
        <div
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 16,
            alignItems: "center",
          }}
        >
          <input
            type="date"
            value={dateRange.start.split("T")[0]}
            onChange={(e) =>
              setDateRange((prev) => ({
                ...prev,
                start: e.target.value + "T00:00:00Z",
              }))
            }
            style={{
              height: 36,
              padding: "0 12px",
              borderRadius: 8,
              border: "1px solid var(--cv4-border-default)",
              background: "var(--cv4-surface-primary)",
              color: "var(--cv4-text-primary)",
              fontSize: 13,
              fontFamily: "Manrope, sans-serif",
            }}
          />
          <span style={{ color: "var(--cv4-text-muted)", fontSize: 13 }}>至</span>
          <input
            type="date"
            value={dateRange.end.split("T")[0]}
            onChange={(e) =>
              setDateRange((prev) => ({
                ...prev,
                end: e.target.value + "T00:00:00Z",
              }))
            }
            style={{
              height: 36,
              padding: "0 12px",
              borderRadius: 8,
              border: "1px solid var(--cv4-border-default)",
              background: "var(--cv4-surface-primary)",
              color: "var(--cv4-text-primary)",
              fontSize: 13,
              fontFamily: "Manrope, sans-serif",
            }}
          />
        </div>
      )}

      {/* Project selector (when in project view) */}
      {viewMode === "project" && (
        <div style={{ marginBottom: 16 }}>
          <input
            type="text"
            placeholder="输入项目 ID 筛选"
            value={selectedProjectId ?? ""}
            onChange={(e) =>
              setSelectedProjectId(e.target.value || null)
            }
            style={{
              height: 36,
              padding: "0 12px",
              borderRadius: 8,
              border: "1px solid var(--cv4-border-default)",
              background: "var(--cv4-surface-primary)",
              color: "var(--cv4-text-primary)",
              fontSize: 13,
              fontFamily: "Manrope, sans-serif",
              width: 280,
            }}
          />
        </div>
      )}

      {/* Loading */}
      {statsLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                background: "var(--cv4-surface-primary)",
                border: "1px solid var(--cv4-border-default)",
                borderRadius: 12,
                padding: "20px 24px",
                height: 96,
                opacity: 0.6,
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
          ))}
        </div>
      ) : statsData && statsData.length === 0 ? (
        /* Empty state */
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 400,
            gap: 12,
          }}
        >
          <h2
            style={{
              fontSize: 20,
              fontWeight: 700,
              fontFamily: "'Space Grotesk', sans-serif",
              color: "var(--cv4-text-primary)",
              margin: 0,
            }}
          >
            暂无使用数据
          </h2>
          <p
            style={{
              fontSize: 13,
              color: "var(--cv4-text-muted)",
              margin: 0,
            }}
          >
            开始使用 AI 功能后，费用和用量数据将在此显示。
          </p>
        </div>
      ) : (
        /* Dashboard content */
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <KPICards
            totalCost={totalCost}
            totalCalls={totalCalls}
            totalTokens={totalTokens}
          />

          {/* Charts row: 2fr line chart + 1fr pie chart */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
            <div
              id="usage-chart-slot"
              style={{
                background: "var(--cv4-surface-primary)",
                border: "1px solid var(--cv4-border-default)",
                borderRadius: 12,
                padding: "20px 24px",
                minHeight: 340,
              }}
            >
              <span style={{ fontSize: 13, color: "var(--cv4-text-muted)" }}>
                {tsLoading ? "加载中..." : "使用趋势"}
              </span>
            </div>
            <div
              id="pie-chart-slot"
              style={{
                background: "var(--cv4-surface-primary)",
                border: "1px solid var(--cv4-border-default)",
                borderRadius: 12,
                padding: "20px 24px",
                minHeight: 340,
              }}
            >
              <span style={{ fontSize: 13, color: "var(--cv4-text-muted)" }}>
                Provider 分布
              </span>
            </div>
          </div>

          {/* Table */}
          <div
            id="usage-table-slot"
            style={{
              background: "var(--cv4-surface-primary)",
              border: "1px solid var(--cv4-border-default)",
              borderRadius: 12,
              padding: "20px 24px",
              minHeight: 200,
            }}
          >
            <span style={{ fontSize: 13, color: "var(--cv4-text-muted)" }}>
              使用明细
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
