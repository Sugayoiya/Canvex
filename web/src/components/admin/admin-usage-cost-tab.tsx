"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi, billingApi } from "@/lib/api";
import { UsageChart } from "@/components/billing/usage-chart";
import { ProviderPieChart } from "@/components/billing/provider-pie-chart";
import { AlertCircle } from "lucide-react";

type Granularity = "hour" | "day" | "week";

export function AdminUsageCostTab() {
  const [granularity, setGranularity] = useState<Granularity>("day");

  const dateRange = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return {
      start_date: start.toISOString().slice(0, 10),
      end_date: end.toISOString().slice(0, 10),
    };
  }, []);

  const {
    data: timeseriesData,
    isLoading: tsLoading,
    isError: tsError,
    refetch: tsRefetch,
  } = useQuery({
    queryKey: [
      "admin",
      "usage-timeseries",
      dateRange.start_date,
      dateRange.end_date,
      granularity,
    ],
    queryFn: () =>
      billingApi
        .usageTimeseries({
          start_date: dateRange.start_date,
          end_date: dateRange.end_date,
          granularity,
        })
        .then((r) => r.data),
    staleTime: 30_000,
  });

  const {
    data: statsData,
    isLoading: statsLoading,
    isError: statsError,
    refetch: statsRefetch,
  } = useQuery({
    queryKey: ["admin", "ai-call-stats"],
    queryFn: () => adminApi.getAiCallStats({}).then((r) => r.data),
    staleTime: 30_000,
  });

  const chartData = useMemo(() => {
    if (!timeseriesData || !Array.isArray(timeseriesData)) return [];
    return timeseriesData.map(
      (item: { period?: string; date?: string; calls?: number; cost?: number; tokens?: number; total_calls?: number; total_cost?: number; total_tokens?: number }) => ({
        period: item.period ?? item.date ?? "",
        calls: item.calls ?? item.total_calls ?? 0,
        cost: item.cost ?? item.total_cost ?? 0,
        tokens: item.tokens ?? item.total_tokens ?? 0,
      })
    );
  }, [timeseriesData]);

  const pieData = useMemo(() => {
    if (!statsData) return [];
    if (Array.isArray(statsData)) {
      return statsData.map(
        (item: { provider?: string; total_cost?: number; cost?: number }) => ({
          provider: item.provider ?? "unknown",
          total_cost: item.total_cost ?? item.cost ?? 0,
        })
      );
    }
    if (statsData.by_provider && Array.isArray(statsData.by_provider)) {
      return statsData.by_provider.map(
        (item: { provider?: string; total_cost?: number; cost?: number }) => ({
          provider: item.provider ?? "unknown",
          total_cost: item.total_cost ?? item.cost ?? 0,
        })
      );
    }
    return [];
  }, [statsData]);

  const isLoading = tsLoading || statsLoading;
  const isError = tsError || statsError;

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {[320, 320].map((h, i) => (
          <div
            key={i}
            style={{
              height: h,
              borderRadius: 12,
              background: "var(--cv4-surface-primary)",
              border: "1px solid var(--cv4-border-subtle)",
              animation: "adminPulse 1.5s infinite",
            }}
          />
        ))}
        <style>{`@keyframes adminPulse { 0%,100% { opacity: 0.3 } 50% { opacity: 0.6 } }`}</style>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "64px 24px",
          gap: 12,
          background: "var(--cv4-surface-primary)",
          border: "1px solid var(--cv4-border-subtle)",
          borderRadius: 12,
        }}
      >
        <AlertCircle
          size={48}
          style={{ color: "var(--ob-error)", opacity: 0.5 }}
        />
        <div
          style={{
            fontFamily: "var(--font-headline)",
            fontSize: 14,
            fontWeight: 700,
            color: "var(--cv4-text-primary)",
          }}
        >
          Failed to load usage data
        </div>
        <div
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 12,
            fontWeight: 400,
            color: "var(--cv4-text-muted)",
          }}
        >
          Failed to load usage data. Check your connection and try again.
        </div>
        <button
          type="button"
          onClick={() => {
            tsRefetch();
            statsRefetch();
          }}
          style={{
            height: 36,
            padding: "0 16px",
            borderRadius: 8,
            border: "none",
            background: "var(--cv4-btn-primary)",
            color: "var(--cv4-btn-primary-text)",
            fontFamily: "var(--font-body)",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  if (chartData.length === 0 && pieData.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "64px 24px",
          gap: 12,
          background: "var(--cv4-surface-primary)",
          border: "1px solid var(--cv4-border-subtle)",
          borderRadius: 12,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-headline)",
            fontSize: 14,
            fontWeight: 700,
            color: "var(--cv4-text-primary)",
          }}
        >
          No usage data available
        </div>
        <div
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 12,
            fontWeight: 400,
            color: "var(--cv4-text-muted)",
          }}
        >
          Usage and cost data will appear here once AI services are used.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <UsageChart
        data={chartData}
        granularity={granularity}
        onGranularityChange={setGranularity}
      />
      <ProviderPieChart data={pieData} />
    </div>
  );
}
