"use client";

import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  createColumnHelper,
} from "@tanstack/react-table";
import { Zap } from "lucide-react";
import { adminApi } from "@/lib/api";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { FilterToolbar } from "@/components/admin/filter-toolbar";
import { StatusBadge } from "@/components/admin/status-badge";
import { useAdminLogTable } from "@/components/admin/use-admin-log-table";
import {
  TIME_RANGE_OPTIONS,
  SKILL_NAME_OPTIONS,
  useUserOptions,
  useTeamOptions,
} from "@/components/admin/use-admin-filter-options";

interface SkillLogItem {
  id: string;
  trace_id: string | null;
  skill_name: string;
  skill_category: string;
  status: "completed" | "failed" | "timeout" | "running" | "queued";
  duration_ms: number | null;
  ai_call_count: number;
  total_input_tokens: number | null;
  total_output_tokens: number | null;
  queued_at: string;
  completed_at: string | null;
  trigger_source: string | null;
}

const columnHelper = createColumnHelper<SkillLogItem>();

export function SkillLogTable() {
  const [statusFilter, setStatusFilter] = useState("");
  const [timeRange, setTimeRange] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [skillFilter, setSkillFilter] = useState("");

  const userOptions = useUserOptions();
  const teamOptions = useTeamOptions();

  const {
    items,
    total,
    isLoading,
    isError,
    refetch,
    page,
    setPage,
    search,
    setSearch,
    pageSize,
  } = useAdminLogTable<SkillLogItem>({
    queryKeyPrefix: "skills",
    fetchFn: (params) => adminApi.listSkillLogs(params),
    filters: {
      status: statusFilter,
      time_range: timeRange,
      user_id: userFilter,
      team_id: teamFilter,
      skill_name: skillFilter,
    },
  });

  const columns = useMemo(
    () => [
      columnHelper.accessor("id", {
        header: "EXECUTION ID",
        size: 120,
        enableSorting: false,
        cell: (info) => {
          const val = info.getValue();
          return (
            <span
              title={val}
              style={{
                fontFamily: "'Space Grotesk', monospace",
                fontSize: 12,
                fontWeight: 400,
                color: "var(--cv4-text-secondary)",
              }}
            >
              {val.slice(0, 8)}
            </span>
          );
        },
      }),
      columnHelper.display({
        id: "skill",
        header: "SKILL",
        size: 140,
        cell: (info) => {
          const row = info.row.original;
          const display = row.skill_category
            ? `${row.skill_category}.${row.skill_name}`
            : row.skill_name;
          return (
            <span
              style={{
                fontFamily: "Manrope, sans-serif",
                fontSize: 12,
                fontWeight: 400,
                color: "var(--cv4-text-secondary)",
              }}
            >
              {display}
            </span>
          );
        },
      }),
      columnHelper.accessor("trigger_source", {
        header: "USER",
        size: 120,
        enableSorting: false,
        cell: (info) => {
          const val = info.getValue();
          return (
            <span
              title={val ?? undefined}
              style={{
                fontFamily: "Manrope, sans-serif",
                fontSize: 12,
                fontWeight: 400,
                color: val ? "var(--cv4-text-secondary)" : "var(--cv4-text-muted)",
                maxWidth: 120,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                display: "inline-block",
              }}
            >
              {val || "—"}
            </span>
          );
        },
      }),
      columnHelper.accessor("status", {
        header: "STATUS",
        size: 80,
        enableSorting: false,
        cell: (info) => {
          const val = info.getValue();
          const mapped = val === "completed" ? "success" : val;
          return <StatusBadge status={mapped as "success" | "failed" | "timeout" | "running" | "queued"} />;
        },
      }),
      columnHelper.accessor("duration_ms", {
        header: "DURATION",
        size: 80,
        enableSorting: false,
        cell: (info) => {
          const val = info.getValue();
          return (
            <span
              style={{
                fontFamily: "Manrope, sans-serif",
                fontSize: 12,
                fontWeight: 400,
                color: val != null ? "var(--cv4-text-secondary)" : "var(--cv4-text-muted)",
              }}
            >
              {val != null ? `${(val / 1000).toFixed(1)}s` : "—"}
            </span>
          );
        },
      }),
      columnHelper.accessor("queued_at", {
        header: "CREATED",
        size: 140,
        enableSorting: false,
        cell: (info) => {
          const val = info.getValue();
          return (
            <span
              title={val}
              style={{
                fontFamily: "Manrope, sans-serif",
                fontSize: 12,
                fontWeight: 400,
                color: "var(--cv4-text-secondary)",
              }}
            >
              {new Date(val).toLocaleString()}
            </span>
          );
        },
      }),
    ],
    []
  );

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <FilterToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by skill name or user..."
        filters={[
          {
            value: timeRange,
            onChange: setTimeRange,
            options: TIME_RANGE_OPTIONS,
          },
          {
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: "", label: "All statuses" },
              { value: "completed", label: "Success" },
              { value: "failed", label: "Failed" },
              { value: "timeout", label: "Timeout" },
            ],
          },
          {
            value: skillFilter,
            onChange: setSkillFilter,
            options: SKILL_NAME_OPTIONS,
          },
          {
            value: userFilter,
            onChange: setUserFilter,
            options: userOptions,
          },
          {
            value: teamFilter,
            onChange: setTeamFilter,
            options: teamOptions,
          },
        ]}
      />
      <AdminDataTable
        table={table}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        emptyIcon={<Zap size={48} />}
        emptyHeading="No skill executions found"
        emptyBody="Skill execution logs will appear here once skills are invoked."
      />
      {!isLoading && !isError && total > 0 && (
        <AdminPagination
          currentPage={page}
          pageCount={Math.ceil(total / pageSize)}
          onPageChange={setPage}
          totalItems={total}
          pageSize={pageSize}
          entityName="executions"
        />
      )}
    </div>
  );
}
