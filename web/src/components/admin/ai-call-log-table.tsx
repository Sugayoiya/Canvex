"use client";

import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  createColumnHelper,
} from "@tanstack/react-table";
import { Cpu } from "lucide-react";
import { adminApi } from "@/lib/api";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { FilterToolbar } from "@/components/admin/filter-toolbar";
import { useAdminLogTable } from "@/components/admin/use-admin-log-table";
import {
  TIME_RANGE_OPTIONS,
  MODEL_OPTIONS,
  useUserOptions,
  useTeamOptions,
} from "@/components/admin/use-admin-filter-options";

interface AiCallLogItem {
  id: string;
  trace_id: string | null;
  provider: string;
  model: string;
  model_type: string;
  input_tokens: number;
  output_tokens: number;
  duration_ms: number | null;
  status: string;
  cost: number | string;
  created_at: string;
}

const columnHelper = createColumnHelper<AiCallLogItem>();

export function AiCallLogTable() {
  const [providerFilter, setProviderFilter] = useState("");
  const [timeRange, setTimeRange] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [modelFilter, setModelFilter] = useState("");

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
  } = useAdminLogTable<AiCallLogItem>({
    queryKeyPrefix: "ai-calls",
    fetchFn: (params) => adminApi.listAiCallLogs(params),
    filters: {
      provider: providerFilter,
      model: modelFilter,
      time_range: timeRange,
      user_id: userFilter,
      team_id: teamFilter,
    },
  });

  const columns = useMemo(
    () => [
      columnHelper.accessor("id", {
        header: "CALL ID",
        size: 100,
        enableSorting: false,
        cell: (info) => (
          <span
            style={{
              fontFamily: "Manrope, sans-serif",
              fontSize: 12,
              fontWeight: 400,
              color: "var(--cv4-text-secondary)",
            }}
          >
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("provider", {
        header: "PROVIDER",
        size: 100,
        enableSorting: false,
        cell: (info) => {
          const val = info.getValue();
          return (
            <span
              style={{
                fontFamily: "Manrope, sans-serif",
                fontSize: 12,
                fontWeight: 400,
                color: "var(--cv4-text-secondary)",
              }}
            >
              {val.charAt(0).toUpperCase() + val.slice(1)}
            </span>
          );
        },
      }),
      columnHelper.accessor("model", {
        header: "MODEL",
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
                maxWidth: 140,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                display: "inline-block",
              }}
            >
              {val}
            </span>
          );
        },
      }),
      columnHelper.display({
        id: "tokens",
        header: "TOKENS",
        size: 80,
        cell: (info) => {
          const row = info.row.original;
          const sum = (row.input_tokens ?? 0) + (row.output_tokens ?? 0);
          return (
            <span
              style={{
                fontFamily: "Manrope, sans-serif",
                fontSize: 12,
                fontWeight: 400,
                color: "var(--cv4-text-secondary)",
              }}
            >
              {sum.toLocaleString()}
            </span>
          );
        },
      }),
      columnHelper.accessor("cost", {
        header: "COST",
        size: 80,
        enableSorting: false,
        cell: (info) => {
          const val = info.getValue();
          return (
            <span
              style={{
                fontFamily: "'Space Grotesk', monospace",
                fontSize: 12,
                fontWeight: 400,
                color: "var(--cv4-text-secondary)",
              }}
            >
              ${parseFloat(String(val)).toFixed(4)}
            </span>
          );
        },
      }),
      columnHelper.accessor("created_at", {
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
        searchPlaceholder="Search by model or provider..."
        filters={[
          {
            value: timeRange,
            onChange: setTimeRange,
            options: TIME_RANGE_OPTIONS,
          },
          {
            value: providerFilter,
            onChange: setProviderFilter,
            options: [
              { value: "", label: "All providers" },
              { value: "gemini", label: "Gemini" },
              { value: "openai", label: "OpenAI" },
              { value: "deepseek", label: "DeepSeek" },
            ],
          },
          {
            value: modelFilter,
            onChange: setModelFilter,
            options: MODEL_OPTIONS,
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
        emptyIcon={<Cpu size={48} />}
        emptyHeading="No AI call logs found"
        emptyBody="AI call logs will appear here once providers process requests."
      />
      {!isLoading && !isError && total > 0 && (
        <AdminPagination
          currentPage={page}
          pageCount={Math.ceil(total / pageSize)}
          onPageChange={setPage}
          totalItems={total}
          pageSize={pageSize}
          entityName="calls"
        />
      )}
    </div>
  );
}
