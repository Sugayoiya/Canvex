"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface AdminPaginationProps {
  currentPage: number;
  pageCount: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  entityName?: string;
}

function getVisiblePages(current: number, total: number): (number | "...")[] {
  if (total <= 5) {
    return Array.from({ length: total }, (_, i) => i);
  }

  const pages: (number | "...")[] = [0];

  const start = Math.max(1, current - 1);
  const end = Math.min(total - 2, current + 1);

  if (start > 1) pages.push("...");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 2) pages.push("...");

  pages.push(total - 1);
  return pages;
}

const navBtnStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 8,
  border: "none",
  background: "transparent",
  color: "var(--cv4-text-secondary)",
  cursor: "pointer",
  padding: 0,
  transition: "background 100ms",
};

export function AdminPagination({
  currentPage,
  pageCount,
  totalItems,
  pageSize,
  onPageChange,
  entityName = "items",
}: AdminPaginationProps) {
  if (pageCount <= 0) return null;

  const start = currentPage * pageSize + 1;
  const end = Math.min((currentPage + 1) * pageSize, totalItems);
  const visiblePages = getVisiblePages(currentPage, pageCount);

  return (
    <nav
      aria-label="Pagination"
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        height: 48,
        borderTop: "1px solid var(--cv4-border-subtle)",
        padding: "0 16px",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 12,
          fontWeight: 400,
          color: "var(--cv4-text-muted)",
        }}
      >
        Showing {start}–{end} of {totalItems} {entityName}
      </span>

      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <button
          type="button"
          disabled={currentPage === 0}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Previous page"
          style={{
            ...navBtnStyle,
            opacity: currentPage === 0 ? 0.3 : 1,
            cursor: currentPage === 0 ? "not-allowed" : "pointer",
          }}
          onMouseEnter={(e) => {
            if (currentPage > 0)
              e.currentTarget.style.background = "var(--cv4-hover-highlight)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          <ChevronLeft size={14} />
        </button>

        {visiblePages.map((page, idx) =>
          page === "..." ? (
            <span
              key={`ellipsis-${idx}`}
              style={{
                width: 32,
                height: 32,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--font-body)",
                fontSize: 12,
                color: "var(--cv4-text-muted)",
              }}
            >
              ...
            </span>
          ) : (
            <button
              type="button"
              key={page}
              aria-current={page === currentPage ? "page" : undefined}
              onClick={() => onPageChange(page)}
              style={{
                width: 32,
                height: 32,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 8,
                border: "none",
                padding: 0,
                fontFamily: "var(--font-body)",
                fontSize: 12,
                fontWeight: page === currentPage ? 700 : 400,
                color:
                  page === currentPage
                    ? "var(--cv4-text-primary)"
                    : "var(--cv4-text-secondary)",
                background:
                  page === currentPage
                    ? "var(--cv4-active-highlight)"
                    : "transparent",
                cursor: "pointer",
                transition: "background 100ms",
              }}
              onMouseEnter={(e) => {
                if (page !== currentPage)
                  e.currentTarget.style.background =
                    "var(--cv4-hover-highlight)";
              }}
              onMouseLeave={(e) => {
                if (page !== currentPage)
                  e.currentTarget.style.background = "transparent";
              }}
            >
              {(page as number) + 1}
            </button>
          )
        )}

        <button
          type="button"
          disabled={currentPage >= pageCount - 1}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Next page"
          style={{
            ...navBtnStyle,
            opacity: currentPage >= pageCount - 1 ? 0.3 : 1,
            cursor: currentPage >= pageCount - 1 ? "not-allowed" : "pointer",
          }}
          onMouseEnter={(e) => {
            if (currentPage < pageCount - 1)
              e.currentTarget.style.background = "var(--cv4-hover-highlight)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </nav>
  );
}
