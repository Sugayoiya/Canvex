"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { billingApi } from "@/lib/api";
import { KPICards } from "./kpi-cards";
import { UsageChart } from "./usage-chart";
import { UsageTable } from "./usage-table";

interface ProjectUsageViewProps {
  dateRange: { start: string; end: string };
  granularity: "hour" | "day" | "week";
  onGranularityChange: (g: "hour" | "day" | "week") => void;
}

interface UsageStatRow {
  provider: string;
  model: string;
  total_calls: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost: number;
}

export function ProjectUsageView({
  dateRange,
  granularity,
  onGranularityChange,
}: ProjectUsageViewProps) {
  const [projectId, setProjectId] = useState<string>("");

  const effectiveProjectId = projectId.trim() || undefined;

  const { data: statsData } = useQuery<UsageStatRow[]>({
    queryKey: ["billing-stats-project", dateRange, effectiveProjectId],
    queryFn: () =>
      billingApi
        .usageStats({
          start_date: dateRange.start,
          end_date: dateRange.end,
          project_id: effectiveProjectId,
        })
        .then((r) => r.data),
    enabled: !!effectiveProjectId,
  });

  const { data: timeseriesData } = useQuery<{
    granularity: string;
    points: Array<{ period: string; calls: number; cost: number; tokens: number }>;
  }>({
    queryKey: [
      "billing-timeseries-project",
      dateRange,
      granularity,
      effectiveProjectId,
    ],
    queryFn: () =>
      billingApi
        .usageTimeseries({
          start_date: dateRange.start,
          end_date: dateRange.end,
          granularity,
          project_id: effectiveProjectId,
        })
        .then((r) => r.data),
    enabled: !!effectiveProjectId,
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <input
          type="text"
          placeholder="输入项目 ID 查看用量"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
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

      {!effectiveProjectId ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 200,
            color: "var(--cv4-text-disabled)",
            fontSize: 13,
            fontFamily: "Manrope, sans-serif",
          }}
        >
          请输入项目 ID 以查看该项目的用量数据
        </div>
      ) : (
        <>
          <KPICards
            totalCost={totalCost}
            totalCalls={totalCalls}
            totalTokens={totalTokens}
          />
          <UsageChart
            data={timeseriesData?.points ?? []}
            granularity={granularity}
            onGranularityChange={onGranularityChange}
          />
          <UsageTable data={statsData ?? []} />
        </>
      )}
    </div>
  );
}
