"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  createColumnHelper,
} from "@tanstack/react-table";
import { Group, Search } from "lucide-react";
import { adminApi } from "@/lib/api";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { FilterToolbar } from "@/components/admin/filter-toolbar";
import { AdminErrorBoundary } from "@/components/admin/admin-error-boundary";

interface AdminTeam {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  member_count: number;
  owner_name: string | null;
}

interface AdminTeamListResponse {
  items: AdminTeam[];
  total: number;
  limit: number;
  offset: number;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const columnHelper = createColumnHelper<AdminTeam>();

export default function AdminTeamsPage() {
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchValue), 300);
    return () => clearTimeout(timer);
  }, [searchValue]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [debouncedSearch]);

  const queryParams = {
    q: debouncedSearch || undefined,
    limit: pagination.pageSize,
    offset: pagination.pageIndex * pagination.pageSize,
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "teams", queryParams],
    queryFn: () =>
      adminApi.listTeams(queryParams).then((r) => r.data as AdminTeamListResponse),
  });

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "NAME",
        enableSorting: false,
        cell: (info) => (
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 12,
              fontWeight: 700,
              color: "var(--cv4-text-primary)",
            }}
          >
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("member_count", {
        header: "MEMBERS",
        enableSorting: false,
        size: 100,
        cell: (info) => (
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 12,
              fontWeight: 400,
              color: "var(--cv4-text-secondary)",
            }}
          >
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("owner_name", {
        header: "OWNER",
        enableSorting: false,
        size: 180,
        cell: (info) => {
          const val = info.getValue();
          return val ? (
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 12,
                fontWeight: 400,
                color: "var(--cv4-text-secondary)",
              }}
            >
              {val}
            </span>
          ) : (
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 12,
                fontWeight: 400,
                color: "var(--cv4-text-muted)",
              }}
            >
              —
            </span>
          );
        },
      }),
      columnHelper.accessor("created_at", {
        header: "CREATED",
        enableSorting: false,
        size: 160,
        cell: (info) => (
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 12,
              fontWeight: 400,
              color: "var(--cv4-text-secondary)",
            }}
          >
            {formatDate(info.getValue())}
          </span>
        ),
      }),
    ],
    []
  );

  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    pageCount: Math.ceil((data?.total ?? 0) / pagination.pageSize),
    state: { pagination },
    onPaginationChange: setPagination,
    manualPagination: true,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
          Teams
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
          View all teams and their members
        </p>
      </div>

      <AdminErrorBoundary>
      <FilterToolbar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder="Search by team name..."
      />

      <AdminDataTable
        table={table}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        emptyIcon={
          debouncedSearch ? <Search size={48} /> : <Group size={48} />
        }
        emptyHeading={debouncedSearch ? "No teams found" : "No teams yet"}
        emptyBody={
          debouncedSearch
            ? "Try adjusting your search."
            : "Teams will appear here once they are created."
        }
        onClearFilters={
          debouncedSearch
            ? () => {
                setSearchValue("");
                setDebouncedSearch("");
              }
            : undefined
        }
        skeletonWidths={[200, 60, 120, 120]}
      />

      {!isLoading && !isError && (data?.total ?? 0) > 0 && (
        <AdminPagination
          currentPage={pagination.pageIndex}
          pageCount={table.getPageCount()}
          totalItems={data?.total ?? 0}
          pageSize={pagination.pageSize}
          onPageChange={(p) =>
            setPagination((prev) => ({ ...prev, pageIndex: p }))
          }
          entityName="teams"
        />
      )}
      </AdminErrorBoundary>
    </div>
  );
}
