"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { taskApi } from "@/lib/api";
import { TaskList } from "./task-list";
import { useAuthStore } from "@/stores/auth-store";

const PAGE_SIZE = 20;

interface TaskCounts {
  running: number;
  completed: number;
  failed: number;
  timeout: number;
  total: number;
}

const FILTER_TABS: { label: string; status: string | null; countKey?: keyof TaskCounts }[] = [
  { label: "全部", status: null },
  { label: "运行中", status: "running", countKey: "running" },
  { label: "已完成", status: "completed", countKey: "completed" },
  { label: "失败", status: "failed", countKey: "failed" },
  { label: "超时", status: "timeout", countKey: "timeout" },
];

export function TaskMonitorPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.is_admin ?? false;

  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isTabVisible, setIsTabVisible] = useState(true);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabVisible(!document.hidden);
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const effectiveRefetchInterval = autoRefresh && isTabVisible ? 5000 : false;

  const { data: tasksResponse, isLoading, isError, refetch } = useQuery({
    queryKey: ["tasks", statusFilter, page],
    queryFn: () =>
      taskApi.list({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        status: statusFilter ?? undefined,
      }),
    refetchInterval: effectiveRefetchInterval,
  });

  const { data: countsData } = useQuery({
    queryKey: ["task-counts"],
    queryFn: () => taskApi.counts().then((r) => r.data as TaskCounts),
    refetchInterval: effectiveRefetchInterval,
  });

  const tasks = tasksResponse?.data ?? [];
  const totalCountHeader = tasksResponse?.headers?.["x-total-count"];
  const totalCount = totalCountHeader
    ? parseInt(totalCountHeader, 10)
    : tasks.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  useEffect(() => {
    setPage(0);
  }, [statusFilter]);

  if (isError) {
    return (
      <div
        style={{
          padding: "24px 32px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "50vh",
          gap: 16,
        }}
      >
        <p
          style={{
            fontFamily: "Space Grotesk, sans-serif",
            fontSize: 16,
            fontWeight: 700,
            color: "var(--cv4-text-primary)",
          }}
        >
          任务列表加载失败
        </p>
        <button
          onClick={() => refetch()}
          style={{
            padding: "8px 20px",
            borderRadius: 8,
            background: "var(--cv4-interactive-buttonPrimary)",
            color: "var(--cv4-surface-primary)",
            border: "none",
            fontFamily: "Manrope, sans-serif",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          重新加载
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 32px", minHeight: "100vh" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <h1
          style={{
            fontFamily: "Space Grotesk, sans-serif",
            fontSize: 20,
            fontWeight: 700,
            color: "var(--cv4-text-primary)",
            margin: 0,
          }}
        >
          任务监控
        </h1>
        <button
          onClick={() => setAutoRefresh((v) => !v)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            borderRadius: 8,
            background: "var(--cv4-surface-primary)",
            border: "1px solid var(--cv4-border-default)",
            fontFamily: "Manrope, sans-serif",
            fontSize: 13,
            color: "var(--cv4-text-secondary)",
            cursor: "pointer",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background:
                autoRefresh && isTabVisible
                  ? "var(--cv5-status-success)"
                  : "var(--cv4-text-disabled)",
              transition: "background 200ms",
            }}
          />
          自动刷新
        </button>
      </div>

      {/* Status filter tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 20,
          borderBottom: "1px solid var(--cv4-border-subtle)",
          paddingBottom: 0,
        }}
      >
        {FILTER_TABS.map((tab) => {
          const isActive = statusFilter === tab.status;
          const count =
            tab.countKey && countsData ? countsData[tab.countKey] : undefined;
          return (
            <button
              key={tab.label}
              onClick={() => setStatusFilter(tab.status)}
              style={{
                padding: "8px 16px",
                fontFamily: "Manrope, sans-serif",
                fontSize: 13,
                fontWeight: isActive ? 700 : 400,
                color: isActive
                  ? "var(--cv4-text-primary)"
                  : "var(--cv4-text-muted)",
                background: "transparent",
                border: "none",
                borderBottom: isActive
                  ? "2px solid var(--cv4-text-primary)"
                  : "2px solid transparent",
                cursor: "pointer",
                transition: "color 100ms, border-color 100ms",
                marginBottom: -1,
              }}
            >
              {tab.label}
              {count != null && (
                <span
                  style={{
                    marginLeft: 6,
                    fontFamily: "Space Grotesk, sans-serif",
                    fontSize: 11,
                    fontWeight: 700,
                    opacity: 0.7,
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Task list or empty state */}
      {isLoading ? (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: 48,
            color: "var(--cv4-text-muted)",
            fontFamily: "Manrope, sans-serif",
            fontSize: 13,
          }}
        >
          加载中...
        </div>
      ) : tasks.length === 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 64,
            gap: 8,
          }}
        >
          <p
            style={{
              fontFamily: "Space Grotesk, sans-serif",
              fontSize: 16,
              fontWeight: 700,
              color: "var(--cv4-text-muted)",
              margin: 0,
            }}
          >
            暂无任务记录
          </p>
          <p
            style={{
              fontFamily: "Manrope, sans-serif",
              fontSize: 13,
              color: "var(--cv4-text-disabled)",
              margin: 0,
            }}
          >
            执行 Canvas 节点或 AI 技能后，任务记录将在此显示。
          </p>
        </div>
      ) : (
        <>
          <TaskList tasks={tasks} isAdmin={isAdmin} />

          {/* Pagination */}
          {totalPages > 1 && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 8,
                marginTop: 20,
              }}
            >
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--cv4-border-default)",
                  background: "var(--cv4-surface-primary)",
                  color:
                    page === 0
                      ? "var(--cv4-text-disabled)"
                      : "var(--cv4-text-secondary)",
                  fontFamily: "Manrope, sans-serif",
                  fontSize: 13,
                  cursor: page === 0 ? "not-allowed" : "pointer",
                }}
              >
                上一页
              </button>
              <span
                style={{
                  fontFamily: "Space Grotesk, sans-serif",
                  fontSize: 13,
                  color: "var(--cv4-text-muted)",
                }}
              >
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--cv4-border-default)",
                  background: "var(--cv4-surface-primary)",
                  color:
                    page >= totalPages - 1
                      ? "var(--cv4-text-disabled)"
                      : "var(--cv4-text-secondary)",
                  fontFamily: "Manrope, sans-serif",
                  fontSize: 13,
                  cursor: page >= totalPages - 1 ? "not-allowed" : "pointer",
                }}
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
