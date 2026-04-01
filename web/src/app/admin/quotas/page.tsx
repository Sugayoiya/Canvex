"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { User, Users as UsersIcon, ChevronUp, ChevronDown, Gauge, Search } from "lucide-react";
import { adminApi, quotaApi } from "@/lib/api";
import { TabBar } from "@/components/admin/tab-bar";
import { FilterToolbar } from "@/components/admin/filter-toolbar";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { AdminErrorBoundary } from "@/components/admin/admin-error-boundary";


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
  monthly_credit_limit: number | null;
  current_month_usage: number;
  daily_call_limit: number | null;
  current_day_calls: number;
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
  monthly_credit_limit: number | null;
  current_month_usage: number;
  daily_call_limit: number | null;
  current_day_calls: number;
}

interface AdminTeamListResponse {
  items: AdminTeam[];
  total: number;
  limit: number;
  offset: number;
}

interface QuotaData {
  user_id?: string | null;
  team_id?: string | null;
  monthly_credit_limit: number | null;
  daily_call_limit: number | null;
  current_month_usage: number;
  current_day_calls: number;
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
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"users" | "teams">("users");
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{
    monthly_credit_limit: string;
    daily_call_limit: string;
  }>({ monthly_credit_limit: "", daily_call_limit: "" });

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

  const quotaQuery = useQuery({
    queryKey: ["admin", "quota", activeTab === "users" ? "user" : "team", expandedId],
    queryFn: () => {
      if (activeTab === "users") return quotaApi.getUserQuota(expandedId!).then((r) => r.data as QuotaData);
      return quotaApi.getTeamQuota(expandedId!).then((r) => r.data as QuotaData);
    },
    enabled: !!expandedId,
  });

  useEffect(() => {
    if (quotaQuery.data) {
      setEditValues({
        monthly_credit_limit: quotaQuery.data.monthly_credit_limit !== null ? String(quotaQuery.data.monthly_credit_limit) : "",
        daily_call_limit: quotaQuery.data.daily_call_limit !== null ? String(quotaQuery.data.daily_call_limit) : "",
      });
    }
  }, [quotaQuery.data]);

  useEffect(() => {
    setEditValues({ monthly_credit_limit: "", daily_call_limit: "" });
  }, [expandedId]);

  const getExpandedName = (): string => {
    if (!expandedId) return "";
    const activeItems = activeQuery.data?.items ?? [];
    if (activeTab === "users") {
      const u = (activeItems as AdminUser[]).find((i) => i.id === expandedId);
      return u?.nickname ?? u?.email ?? expandedId;
    }
    const t = (activeItems as AdminTeam[]).find((i) => i.id === expandedId);
    return t?.name ?? expandedId;
  };

  const saveMutation = useMutation({
    mutationFn: (data: { monthly_credit_limit?: number | null; daily_call_limit?: number | null }) => {
      if (activeTab === "users") return quotaApi.updateUserQuota(expandedId!, data);
      return quotaApi.updateTeamQuota(expandedId!, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "quota"] });
      toast.success(`已更新 ${getExpandedName()} 的配额`);
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Unknown error";
      toast.error(`配额更新失败: ${message}`);
    },
  });

  const handleSave = () => {
    const payload: { monthly_credit_limit?: number | null; daily_call_limit?: number | null } = {};
    if (editValues.monthly_credit_limit === "") {
      payload.monthly_credit_limit = null;
    } else {
      const v = parseFloat(editValues.monthly_credit_limit);
      if (isNaN(v) || v < 0) return;
      payload.monthly_credit_limit = v;
    }
    if (editValues.daily_call_limit === "") {
      payload.daily_call_limit = null;
    } else {
      const v = parseInt(editValues.daily_call_limit, 10);
      if (isNaN(v) || v < 0) return;
      payload.daily_call_limit = v;
    }
    saveMutation.mutate(payload);
  };

  const handleReset = (field: "monthly_credit_limit" | "daily_call_limit") => {
    setEditValues((prev) => ({ ...prev, [field]: "" }));
    saveMutation.mutate(
      { [field]: null },
      {
        onSuccess: () => {
          toast.success(`已重置 ${getExpandedName()} 的配额为无限制`);
          queryClient.invalidateQueries({ queryKey: ["admin", "quota"] });
        },
        onError: (err: unknown) => {
          const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Unknown error";
          toast.error(`配额重置失败: ${message}`);
        },
      },
    );
  };

  const isDirty = (() => {
    if (!quotaQuery.data) return false;
    const qd = quotaQuery.data;
    const origMonthly = qd.monthly_credit_limit !== null ? String(qd.monthly_credit_limit) : "";
    const origDaily = qd.daily_call_limit !== null ? String(qd.daily_call_limit) : "";
    return editValues.monthly_credit_limit !== origMonthly || editValues.daily_call_limit !== origDaily;
  })();

  const activeQuery = activeTab === "users" ? usersQuery : teamsQuery;
  const items: Array<AdminUser | AdminTeam> = activeQuery.data?.items ?? [];
  const total = activeQuery.data?.total ?? 0;
  const pageCount = Math.ceil(total / pagination.pageSize);

  const handleTabChange = (tab: string) => {
    if (saveMutation.isPending) return;
    setActiveTab(tab as "users" | "teams");
    setSearchValue("");
    setDebouncedSearch("");
    setExpandedId(null);
    setPagination({ pageIndex: 0, pageSize: 20 });
  };

  const handleRowClick = (id: string) => {
    if (saveMutation.isPending) return;
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

      <AdminErrorBoundary>
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
                  {/* Row header */}
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
                      height: 72,
                      padding: "0 20px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
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
                    {/* Left: Name + secondary */}
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{
                          fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 700,
                          color: "var(--cv4-text-primary)", whiteSpace: "nowrap",
                        }}>
                          {user ? user.nickname : team?.name}
                        </span>
                        <span style={{
                          fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, fontWeight: 400,
                          color: "var(--cv4-text-muted)", letterSpacing: "0.3px",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {user ? user.email : `${team?.member_count ?? 0} members`}
                        </span>
                      </div>
                    </div>

                    {/* Right: Usage info + chevron */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                        <span style={{
                          fontFamily: "Manrope, sans-serif", fontSize: 11, fontWeight: 400,
                          color: "var(--cv4-text-muted)",
                        }}>
                          {isExpanded ? "Monthly Usage Summary" : "Monthly Usage"}
                        </span>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                          {item.monthly_credit_limit !== null ? (
                            <>
                              <span style={{
                                fontFamily: "'Space Grotesk', sans-serif",
                                fontSize: isExpanded ? 20 : 18, fontWeight: 700,
                                color: "var(--cv4-text-primary)",
                              }}>
                                {Math.round(item.current_month_usage).toLocaleString()}
                              </span>
                              <span style={{
                                fontFamily: "Manrope, sans-serif", fontSize: 12, fontWeight: 400,
                                color: "var(--cv4-text-muted)",
                              }}>
                                / {Math.round(item.monthly_credit_limit).toLocaleString()} credits
                              </span>
                            </>
                          ) : (
                            <span style={{
                              display: "inline-flex", alignItems: "center",
                              height: 24, padding: "4px 8px", borderRadius: 6,
                              background: "var(--cv4-hover-highlight)",
                              color: "var(--cv4-text-secondary)",
                              fontFamily: "Manrope, sans-serif", fontSize: 12, fontWeight: 400,
                            }}>
                              Unlimited
                            </span>
                          )}
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp size={16} style={{ color: "var(--cv4-text-muted)", flexShrink: 0 }} />
                      ) : (
                        <ChevronDown size={16} style={{ color: "var(--cv4-text-muted)", flexShrink: 0 }} />
                      )}
                    </div>
                  </div>

                  {/* QuotaDetailArea */}
                  {isExpanded && (
                    <div
                      style={{
                        background: "var(--cv4-canvas-bg)",
                        padding: "16px 24px 20px",
                        borderTop: "1px solid var(--cv4-border-subtle)",
                        borderBottom: isLast
                          ? "none"
                          : "1px solid var(--cv4-border-subtle)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 16,
                      }}
                    >
                      {quotaQuery.isLoading && (
                        <div style={{ display: "flex", gap: 24 }}>
                          <div style={{ flex: 1, height: 90, borderRadius: 8, background: "var(--cv4-border-default)", animation: "pulse 1.5s ease-in-out infinite" }} />
                          <div style={{ flex: 1, height: 90, borderRadius: 8, background: "var(--cv4-border-default)", animation: "pulse 1.5s ease-in-out infinite" }} />
                        </div>
                      )}
                      {quotaQuery.isError && (
                        <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--cv4-text-muted)", margin: 0 }}>
                          Failed to load quota data.
                        </p>
                      )}
                      {quotaQuery.data && (() => {
                        const qd = quotaQuery.data;
                        const monthPct = qd.monthly_credit_limit && qd.monthly_credit_limit > 0 ? (qd.current_month_usage / qd.monthly_credit_limit) * 100 : 0;
                        const dayPct = qd.daily_call_limit && qd.daily_call_limit > 0 ? (qd.current_day_calls / qd.daily_call_limit) * 100 : 0;
                        const monthColor = monthPct >= 85 ? "var(--ob-error)" : monthPct >= 60 ? "var(--ob-tertiary)" : "var(--ob-success)";
                        const dayColor = dayPct >= 85 ? "var(--ob-error)" : dayPct >= 60 ? "var(--ob-tertiary)" : "var(--ob-success)";
                        const showWarning = dayPct >= 85 || monthPct >= 85;

                        const labelStyle = { fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, fontWeight: 700 as const, color: "var(--cv4-text-muted)", letterSpacing: "0.5px", textTransform: "uppercase" as const };
                        const pctStyle = (color: string) => ({ fontFamily: "Manrope, sans-serif", fontSize: 11, fontWeight: 600 as const, color });
                        const inputStyle = {
                          height: 32, border: "1px solid var(--cv4-border-subtle)", borderRadius: 6,
                          background: "var(--cv4-surface-primary)", fontFamily: "Manrope, sans-serif", fontSize: 12,
                          fontWeight: 400 as const, color: "var(--cv4-text-primary)", padding: "0 10px", outline: "none", flex: 1,
                        };
                        const resetBtnStyle = {
                          height: 32, padding: "0 12px", borderRadius: 6,
                          border: "1px solid var(--cv4-border-subtle)", background: "var(--cv4-surface-primary)",
                          fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, fontWeight: 700 as const,
                          color: "var(--cv4-text-secondary)", letterSpacing: "0.5px",
                          cursor: saveMutation.isPending ? "not-allowed" as const : "pointer" as const,
                          opacity: saveMutation.isPending ? 0.4 : 1,
                        };

                        return (
                          <>
                            {/* Dual-column layout */}
                            <div style={{ display: "flex", gap: 24 }}>
                              {/* Monthly Column */}
                              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <span style={labelStyle}>MONTHLY CREDIT LIMIT (TOTAL)</span>
                                  {qd.monthly_credit_limit !== null && (
                                    <span style={pctStyle(monthColor)}>{monthPct.toFixed(1)}% Used</span>
                                  )}
                                </div>
                                {qd.monthly_credit_limit !== null ? (
                                  <div style={{ height: 6, borderRadius: 3, background: "#3c494e40", overflow: "hidden" }}>
                                    <div style={{ height: 6, borderRadius: 3, width: `${Math.min(100, monthPct)}%`, background: monthColor, transition: "width 300ms ease" }} />
                                  </div>
                                ) : (
                                  <span style={{ display: "inline-flex", alignItems: "center", height: 24, padding: "4px 8px", borderRadius: 6, background: "var(--cv4-hover-highlight)", color: "var(--cv4-text-secondary)", fontFamily: "Manrope, sans-serif", fontSize: 12, fontWeight: 400, width: "fit-content" }}>Unlimited</span>
                                )}
                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                  <span style={labelStyle}>LIMIT</span>
                                  <input
                                    type="number" min="0" aria-label="Monthly credit limit" placeholder="Set limit..."
                                    value={editValues.monthly_credit_limit}
                                    onChange={(e) => setEditValues((prev) => ({ ...prev, monthly_credit_limit: e.target.value }))}
                                    readOnly={saveMutation.isPending}
                                    style={inputStyle}
                                  />
                                  {qd.monthly_credit_limit !== null && (
                                    <button type="button" onClick={() => !saveMutation.isPending && handleReset("monthly_credit_limit")} style={resetBtnStyle}>RESET</button>
                                  )}
                                </div>
                              </div>

                              {/* Daily Column */}
                              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <span style={labelStyle}>DAILY CALL LIMIT (TOTAL)</span>
                                  {qd.daily_call_limit !== null && (
                                    <span style={pctStyle(dayColor)}>{dayPct.toFixed(1)}% Used</span>
                                  )}
                                </div>
                                {qd.daily_call_limit !== null ? (
                                  <div style={{ height: 6, borderRadius: 3, background: "#3c494e40", overflow: "hidden" }}>
                                    <div style={{ height: 6, borderRadius: 3, width: `${Math.min(100, dayPct)}%`, background: dayColor, transition: "width 300ms ease" }} />
                                  </div>
                                ) : (
                                  <span style={{ display: "inline-flex", alignItems: "center", height: 24, padding: "4px 8px", borderRadius: 6, background: "var(--cv4-hover-highlight)", color: "var(--cv4-text-secondary)", fontFamily: "Manrope, sans-serif", fontSize: 12, fontWeight: 400, width: "fit-content" }}>Unlimited</span>
                                )}
                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                  <span style={labelStyle}>LIMIT</span>
                                  <input
                                    type="number" min="0" aria-label="Daily call limit" placeholder="Set limit..."
                                    value={editValues.daily_call_limit}
                                    onChange={(e) => setEditValues((prev) => ({ ...prev, daily_call_limit: e.target.value }))}
                                    readOnly={saveMutation.isPending}
                                    style={inputStyle}
                                  />
                                  {qd.daily_call_limit !== null && (
                                    <button type="button" onClick={() => !saveMutation.isPending && handleReset("daily_call_limit")} style={resetBtnStyle}>RESET</button>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Warning banner */}
                            {showWarning && (
                              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <span style={{ color: "var(--ob-tertiary)", display: "flex" }}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                                </span>
                                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, fontWeight: 700, color: "var(--ob-tertiary)", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                                  {dayPct >= 85 ? "USER IS APPROACHING THE DAILY RATE LIMIT." : "USER IS APPROACHING THE MONTHLY CREDIT LIMIT."}
                                </span>
                              </div>
                            )}

                            {/* Save button */}
                            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                              <button
                                type="button"
                                disabled={!isDirty || saveMutation.isPending}
                                onClick={handleSave}
                                style={{
                                  height: 36, padding: "0 16px", borderRadius: 8, border: "none",
                                  background: "var(--cv4-btn-primary)", color: "var(--cv4-btn-primary-text)",
                                  fontFamily: "Manrope, sans-serif", fontSize: 12, fontWeight: 700,
                                  cursor: !isDirty || saveMutation.isPending ? "not-allowed" : "pointer",
                                  opacity: !isDirty || saveMutation.isPending ? 0.4 : 1,
                                  transition: "opacity 100ms",
                                }}
                              >
                                {saveMutation.isPending ? "..." : "Save Changes"}
                              </button>
                            </div>
                          </>
                        );
                      })()}
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

          {/* OrgTotalBar — Teams tab */}
          {activeTab === "teams" && items.length > 0 && (() => {
            const allTeams = items as AdminTeam[];
            const totalUsage = allTeams.reduce((s, t) => s + (t.current_month_usage ?? 0), 0);
            const totalLimit = allTeams.reduce((s, t) => s + (t.monthly_credit_limit ?? 0), 0);
            const hasAnyLimit = allTeams.some(t => t.monthly_credit_limit !== null);
            const pct = hasAnyLimit && totalLimit > 0 ? (totalUsage / totalLimit) * 100 : 0;
            const barColor = pct >= 85 ? "var(--ob-error)" : pct >= 60 ? "var(--ob-tertiary)" : "var(--ob-success)";
            return (
              <div style={{
                height: 48,
                background: "var(--cv4-surface-primary)",
                border: "1px solid var(--cv4-border-subtle)",
                borderRadius: 12,
                padding: "0 16px",
                display: "flex",
                alignItems: "center",
                gap: 16,
                marginTop: 16,
              }}>
                <span style={{ fontFamily: "Manrope, sans-serif", fontSize: 12, fontWeight: 700, color: "var(--cv4-text-primary)" }}>
                  Org Total Usage
                </span>
                {hasAnyLimit && (
                  <div style={{ width: 200, height: 8, borderRadius: 4, background: "var(--cv4-border-default)", overflow: "hidden" }}>
                    <div style={{ height: 8, borderRadius: 4, width: `${Math.min(100, pct)}%`, background: barColor, transition: "width 300ms ease" }} />
                  </div>
                )}
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 700, color: "var(--cv4-text-primary)" }}>
                  {hasAnyLimit
                    ? `${Math.round(totalUsage).toLocaleString()} / ${Math.round(totalLimit).toLocaleString()}`
                    : "No limits set"}
                </span>
                {hasAnyLimit && (
                  <span style={{
                    display: "inline-flex",
                    alignItems: "center",
                    height: 24,
                    padding: "4px 8px",
                    borderRadius: 6,
                    background: "var(--cv4-hover-highlight)",
                    fontFamily: "Manrope, sans-serif",
                    fontSize: 12,
                    fontWeight: 700,
                    color: barColor,
                  }}>
                    {Math.round(pct)}%
                  </span>
                )}
              </div>
            );
          })()}

          {/* BottomStats — Users tab */}
          {activeTab === "users" && items.length > 0 && (() => {
            const allUsers = items as AdminUser[];
            const activeCount = allUsers.filter(u => u.status === "active").length;
            const usersWithLimit = allUsers.filter(u => u.monthly_credit_limit !== null && u.monthly_credit_limit > 0);
            const avgUsage = usersWithLimit.length > 0
              ? usersWithLimit.reduce((s, u) => s + ((u.current_month_usage / u.monthly_credit_limit!) * 100), 0) / usersWithLimit.length
              : 0;
            const totalOverhead = allUsers.reduce((s, u) => s + (u.current_month_usage ?? 0), 0);
            return (
              <div style={{
                display: "flex",
                gap: 24,
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 16,
                padding: 16,
                background: "var(--cv4-surface-primary)",
                border: "1px solid var(--cv4-border-subtle)",
                borderRadius: 12,
              }}>
                <div style={{ display: "flex", gap: 24 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontFamily: "Manrope, sans-serif", fontSize: 12, fontWeight: 400, color: "var(--cv4-text-muted)" }}>Active Users</span>
                    <span style={{ fontFamily: "Manrope, sans-serif", fontSize: 12, fontWeight: 700, color: "var(--cv4-text-primary)" }}>{activeCount}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontFamily: "Manrope, sans-serif", fontSize: 12, fontWeight: 400, color: "var(--cv4-text-muted)" }}>Avg Monthly Usage</span>
                    <span style={{ fontFamily: "Manrope, sans-serif", fontSize: 12, fontWeight: 700, color: "var(--cv4-text-primary)" }}>{avgUsage.toFixed(1)}%</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontFamily: "Manrope, sans-serif", fontSize: 12, fontWeight: 400, color: "var(--cv4-text-muted)" }}>Total Overhead</span>
                    <span style={{ fontFamily: "Manrope, sans-serif", fontSize: 12, fontWeight: 700, color: "var(--cv4-text-primary)" }}>{Math.round(totalOverhead).toLocaleString()}</span>
                  </div>
                </div>
                <button
                  type="button"
                  style={{
                    height: 36,
                    padding: "0 16px",
                    borderRadius: 8,
                    border: "1px solid var(--cv4-border-default)",
                    background: "transparent",
                    color: "var(--cv4-text-secondary)",
                    fontFamily: "Manrope, sans-serif",
                    fontSize: 12,
                    fontWeight: 400,
                    cursor: "pointer",
                  }}
                >
                  Export System Report
                </button>
              </div>
            );
          })()}
        </>
      )}
      </AdminErrorBoundary>
    </div>
  );
}
