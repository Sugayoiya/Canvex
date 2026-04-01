"use client";

import { type Table, flexRender } from "@tanstack/react-table";
import { ArrowUp, ArrowDown, AlertCircle } from "lucide-react";

interface AdminDataTableProps<T> {
  table: Table<T>;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  emptyIcon?: React.ReactNode;
  emptyHeading?: string;
  emptyBody?: string;
  onClearFilters?: () => void;
  skeletonWidths?: number[];
}

const DEFAULT_SKELETON_WIDTHS = [120, 160, 60, 50, 80, 100, 100, 32];

function SkeletonRow({ widths }: { widths: number[] }) {
  return (
    <tr style={{ height: 48 }}>
      {widths.map((w, i) => (
        <td key={i} style={{ padding: "0 16px" }}>
          <div
            style={{
              width: w,
              height: 12,
              borderRadius: 6,
              background: "var(--cv4-text-muted)",
              opacity: 0.15,
              animation: "adminPulse 1.5s infinite",
            }}
          />
        </td>
      ))}
    </tr>
  );
}

export function AdminDataTable<T>({
  table,
  isLoading,
  isError,
  onRetry,
  emptyIcon,
  emptyHeading = "No results found",
  emptyBody = "Try adjusting your search or filters.",
  onClearFilters,
  skeletonWidths,
}: AdminDataTableProps<T>) {
  const columns = table.getAllColumns();
  const colCount = columns.length;
  const skelWidths =
    skeletonWidths ?? DEFAULT_SKELETON_WIDTHS.slice(0, colCount);

  return (
    <div
      style={{
        background: "var(--cv4-surface-primary)",
        border: "1px solid var(--cv4-border-subtle)",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <style>{`@keyframes adminPulse { 0%,100% { opacity: 0.3 } 50% { opacity: 0.6 } }`}</style>
      <table role="table" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr
              key={headerGroup.id}
              style={{
                height: 40,
                background: "var(--cv4-canvas-bg)",
                borderBottom: "1px solid var(--cv4-border-default)",
              }}
            >
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const sorted = header.column.getIsSorted();
                const ariaSortValue = sorted
                  ? sorted === "asc"
                    ? ("ascending" as const)
                    : ("descending" as const)
                  : ("none" as const);

                return (
                  <th
                    key={header.id}
                    scope="col"
                    aria-sort={canSort ? ariaSortValue : undefined}
                    onClick={
                      canSort
                        ? header.column.getToggleSortingHandler()
                        : undefined
                    }
                    style={{
                      padding: "0 16px",
                      textAlign: "left",
                      fontFamily: "var(--font-headline)",
                      fontSize: 12,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                      color: sorted
                        ? "var(--cv4-text-primary)"
                        : "var(--cv4-text-muted)",
                      cursor: canSort ? "pointer" : "default",
                      userSelect: "none",
                      whiteSpace: "nowrap",
                    }}
                    onMouseEnter={(e) => {
                      if (canSort && !sorted)
                        e.currentTarget.style.color =
                          "var(--cv4-text-secondary)";
                    }}
                    onMouseLeave={(e) => {
                      if (canSort && !sorted)
                        e.currentTarget.style.color = "var(--cv4-text-muted)";
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                      {canSort && sorted === "asc" && <ArrowUp size={12} />}
                      {canSort && sorted === "desc" && <ArrowDown size={12} />}
                      {canSort && !sorted && (
                        <ArrowUp size={12} style={{ opacity: 0.3 }} />
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {isLoading ? (
            Array.from({ length: 10 }).map((_, i) => (
              <SkeletonRow key={i} widths={skelWidths} />
            ))
          ) : isError ? (
            <tr>
              <td colSpan={colCount}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "64px 24px",
                    gap: 12,
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
                    Failed to load data
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: 12,
                      fontWeight: 400,
                      color: "var(--cv4-text-muted)",
                    }}
                  >
                    An error occurred while fetching data.
                  </div>
                  {onRetry && (
                    <button
                      type="button"
                      onClick={onRetry}
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
                      Retry
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ) : table.getRowModel().rows.length === 0 ? (
            <tr>
              <td colSpan={colCount}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "64px 24px",
                    gap: 12,
                  }}
                >
                  {emptyIcon && (
                    <div style={{ opacity: 0.5, color: "var(--cv4-text-muted)" }}>
                      {emptyIcon}
                    </div>
                  )}
                  <div
                    style={{
                      fontFamily: "var(--font-headline)",
                      fontSize: 14,
                      fontWeight: 700,
                      color: "var(--cv4-text-primary)",
                    }}
                  >
                    {emptyHeading}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: 12,
                      fontWeight: 400,
                      color: "var(--cv4-text-muted)",
                    }}
                  >
                    {emptyBody}
                  </div>
                  {onClearFilters && (
                    <button
                      type="button"
                      onClick={onClearFilters}
                      style={{
                        height: 36,
                        padding: "0 16px",
                        borderRadius: 8,
                        border: "1px solid var(--cv4-btn-secondary-border)",
                        background: "var(--cv4-btn-secondary)",
                        color: "var(--cv4-btn-secondary-text)",
                        fontFamily: "var(--font-body)",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row, rowIdx) => (
              <tr
                key={row.id}
                style={{
                  height: 48,
                  borderBottom:
                    rowIdx < table.getRowModel().rows.length - 1
                      ? "1px solid var(--cv4-border-subtle)"
                      : undefined,
                  transition: "background 100ms",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#E5E2E108";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} style={{ padding: "0 16px" }}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
