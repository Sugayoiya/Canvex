"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { User, Users as UsersIcon, ChevronRight, ChevronDown, Gauge, Search } from "lucide-react";
import { adminApi } from "@/lib/api";
import { TabBar } from "@/components/admin/tab-bar";
import { FilterToolbar } from "@/components/admin/filter-toolbar";
import { AdminPagination } from "@/components/admin/admin-pagination";

interface AdminUser {
  id: string;
  email: string;
  nickname: string;
  avatar: string | null;
  status: "active" | "banned";
  is_admin: boolean;
  teams: string[];
  last_login_at: string | null;
  created_at: string;
}

interface AdminUserListResponse {
  items: AdminUser[];
  total: number;
  limit: number;
  offset: number;
  admin_count: number;
}

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

const tabs = [
  { id: "users", label: "Users", icon: <User size={14} /> },
  { id: "teams", label: "Teams", icon: <UsersIcon size={14} /> },
];

function SkeletonRow() {
  return (
    <div
      style={{
        height: 56,
        padding: "0 16px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        borderBottom: "1px solid var(--cv4-border-subtle)",
      }}
    >
      <div style={{ width: 14, height: 14, borderRadius: 4, background: "var(--cv4-border-default)", animation: "pulse 1.5s ease-in-out infinite" }} />
      <div style={{ width: 120, height: 12, borderRadius: 4, background: "var(--cv4-border-default)", animation: "pulse 1.5s ease-in-out infinite" }} />
      <div style={{ width: 160, height: 12, borderRadius: 4, background: "var(--cv4-border-default)", animation: "pulse 1.5s ease-in-out infinite" }} />
      <div style={{ width: 100, height: 12, borderRadius: 4, background: "var(--cv4-border-default)", animation: "pulse 1.5s ease-in-out infinite" }} />
    </div>
  );
}

export default function AdminQuotasPage() {
  const [activeTab, setActiveTab] = useState<"users" | "teams">("users");
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // saveMutation guard placeholder — replaced in Task 2 with real mutation
  const savePending = false;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchValue), 300);
    return () => clearTimeout(timer);
  }, [searchValue]);

  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [debouncedSearch, activeTab]);

  const usersQuery = useQuery({
    queryKey: [
      "admin",
      "users",
      {
        q: debouncedSearch,
        limit: pagination.pageSize,
        offset: pagination.pageIndex * pagination.pageSize,
      },
    ],
    queryFn: () =>
      adminApi
        .listUsers({
          q: debouncedSearch || undefined,
          limit: pagination.pageSize,
          offset: pagination.pageIndex * pagination.pageSize,
        })
        .then((r) => r.data as AdminUserListResponse),
    enabled: activeTab === "users",
  });

  const teamsQuery = useQuery({
    queryKey: [
      "admin",
      "teams",
      {
        q: debouncedSearch,
        limit: pagination.pageSize,
        offset: pagination.pageIndex * pagination.pageSize,
      },
    ],
    queryFn: () =>
      adminApi
        .listTeams({
          q: debouncedSearch || undefined,
          limit: pagination.pageSize,
          offset: pagination.pageIndex * pagination.pageSize,
        })
        .then((r) => r.data as AdminTeamListResponse),
    enabled: activeTab === "teams",
  });

  const activeQuery = activeTab === "users" ? usersQuery : teamsQuery;
  const items: Array<AdminUser | AdminTeam> = activeQuery.data?.items ?? [];
  const total = activeQuery.data?.total ?? 0;
  const pageCount = Math.ceil(total / pagination.pageSize);

  const handleTabChange = (tab: string) => {
    if (savePending) return;
    setActiveTab(tab as "users" | "teams");
    setSearchValue("");
    setDebouncedSearch("");
    setExpandedId(null);
    setPagination({ pageIndex: 0, pageSize: 20 });
  };

  const handleRowClick = (id: string) => {
    if (savePending) return;
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const hasSearch = !!debouncedSearch;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* PageHeader */}
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
          Quotas
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
          Allocate and monitor API usage. Limits reset every 30 days.
        </p>
      </div>

      {/* TabBar */}
      <TabBar tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} />

      {/* FilterToolbar */}
      <FilterToolbar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder={
          activeTab === "users"
            ? "Search by name or email..."
            : "Search by team name..."
        }
      />

      {/* Loading */}
      {activeQuery.isLoading && (
        <div
          style={{
            borderRadius: 12,
            border: "1px solid var(--cv4-border-subtle)",
            overflow: "hidden",
          }}
        >
          {Array.from({ length: 10 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      )}

      {/* Error */}
      {activeQuery.isError && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 64,
            borderRadius: 12,
            background: "var(--cv4-surface-primary)",
            border: "1px solid var(--cv4-border-subtle)",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-headline)",
              fontSize: 14,
              fontWeight: 700,
              color: "var(--cv4-text-primary)",
              margin: 0,
            }}
          >
            Failed to load quotas
          </p>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 12,
              fontWeight: 400,
              color: "var(--cv4-text-muted)",
              margin: "8px 0 0",
            }}
          >
            Something went wrong. Please try again.
          </p>
          <button
            type="button"
            onClick={() => activeQuery.refetch()}
            style={{
              marginTop: 16,
              height: 36,
              padding: "0 16px",
              borderRadius: 8,
              border: "1px solid var(--cv4-border-default)",
              background: "transparent",
              color: "var(--cv4-text-primary)",
              fontFamily: "var(--font-body)",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty state — no data */}
      {!activeQuery.isLoading && !activeQuery.isError && items.length === 0 && !hasSearch && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 64,
            borderRadius: 12,
            background: "var(--cv4-surface-primary)",
            border: "1px solid var(--cv4-border-subtle)",
          }}
        >
          <Gauge
            size={48}
            style={{ color: "var(--cv4-text-muted)", marginBottom: 16, opacity: 0.5 }}
          />
          <p
            style={{
              fontFamily: "var(--font-headline)",
              fontSize: 14,
              fontWeight: 700,
              color: "var(--cv4-text-primary)",
              margin: 0,
            }}
          >
            {activeTab === "users" ? "No users found" : "No teams found"}
          </p>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 12,
              fontWeight: 400,
              color: "var(--cv4-text-muted)",
              margin: "8px 0 0",
            }}
          >
            {activeTab === "users"
              ? "Users will appear here once they register."
              : "Teams will appear here once they are created."}
          </p>
        </div>
      )}

      {/* Empty state — search no results */}
      {!activeQuery.isLoading && !activeQuery.isError && items.length === 0 && hasSearch && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 64,
            borderRadius: 12,
            background: "var(--cv4-surface-primary)",
            border: "1px solid var(--cv4-border-subtle)",
          }}
        >
          <Search
            size={48}
            style={{ color: "var(--cv4-text-muted)", marginBottom: 16, opacity: 0.5 }}
          />
          <p
            style={{
              fontFamily: "var(--font-headline)",
              fontSize: 14,
              fontWeight: 700,
              color: "var(--cv4-text-primary)",
              margin: 0,
            }}
          >
            {activeTab === "users" ? "No users found" : "No teams found"}
          </p>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 12,
              fontWeight: 400,
              color: "var(--cv4-text-muted)",
              margin: "8px 0 0",
            }}
          >
            Try adjusting your search.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchValue("");
              setDebouncedSearch("");
            }}
            style={{
              marginTop: 16,
              height: 36,
              padding: "0 16px",
              borderRadius: 8,
              border: "1px solid var(--cv4-border-default)",
              background: "transparent",
              color: "var(--cv4-text-secondary)",
              fontFamily: "var(--font-body)",
              fontSize: 12,
              fontWeight: 400,
              cursor: "pointer",
            }}
          >
            Clear search
          </button>
        </div>
      )}

      {/* QuotaList */}
      {!activeQuery.isLoading && !activeQuery.isError && items.length > 0 && (
        <>
          <div
            style={{
              borderRadius: 12,
              border: "1px solid var(--cv4-border-subtle)",
              overflow: "hidden",
            }}
          >
            {items.map((item, idx) => {
              const isExpanded = expandedId === item.id;
              const isLast = idx === items.length - 1;
              const isUser = activeTab === "users";
              const user = isUser ? (item as AdminUser) : null;
              const team = !isUser ? (item as AdminTeam) : null;

              return (
                <div key={item.id}>
                  {/* Collapsed row */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleRowClick(item.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleRowClick(item.id);
                      }
                    }}
                    style={{
                      height: 56,
                      padding: "0 16px",
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      cursor: "pointer",
                      borderBottom: isLast && !isExpanded
                        ? "none"
                        : "1px solid var(--cv4-border-subtle)",
                      transition: "background 100ms",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#E5E2E108";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {/* Expand indicator */}
                    {isExpanded ? (
                      <ChevronDown
                        size={14}
                        style={{ color: "var(--cv4-text-muted)", flexShrink: 0 }}
                      />
                    ) : (
                      <ChevronRight
                        size={14}
                        style={{ color: "var(--cv4-text-muted)", flexShrink: 0 }}
                      />
                    )}

                    {/* Name */}
                    <span
                      style={{
                        minWidth: 180,
                        fontFamily: "Manrope, sans-serif",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "var(--cv4-text-primary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {user ? user.nickname : team?.name}
                    </span>

                    {/* Secondary */}
                    <span
                      style={{
                        minWidth: 200,
                        fontFamily: "Manrope, sans-serif",
                        fontSize: 12,
                        fontWeight: 400,
                        color: "var(--cv4-text-secondary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {user
                        ? user.email
                        : `${team?.member_count ?? 0} members`}
                    </span>

                    {/* Quota summary placeholder */}
                    <span
                      style={{
                        flex: 1,
                        fontFamily: "Manrope, sans-serif",
                        fontSize: 12,
                        fontWeight: 400,
                        color: "var(--cv4-text-muted)",
                      }}
                    >
                      —
                    </span>
                  </div>

                  {/* Expanded area placeholder */}
                  {isExpanded && (
                    <div
                      style={{
                        background: "var(--cv4-canvas-bg)",
                        padding: 24,
                        borderTop: "1px solid var(--cv4-border-subtle)",
                        borderBottom: isLast
                          ? "none"
                          : "1px solid var(--cv4-border-subtle)",
                      }}
                    >
                      <p
                        style={{
                          fontFamily: "var(--font-body)",
                          fontSize: 12,
                          color: "var(--cv4-text-muted)",
                          margin: 0,
                        }}
                      >
                        QuotaDetailArea placeholder
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          <AdminPagination
            currentPage={pagination.pageIndex}
            pageCount={pageCount}
            totalItems={total}
            pageSize={pagination.pageSize}
            onPageChange={(p) =>
              setPagination((prev) => ({ ...prev, pageIndex: p }))
            }
            entityName={activeTab}
          />
        </>
      )}
    </div>
  );
}
