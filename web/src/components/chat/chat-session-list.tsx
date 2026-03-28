"use client";

import { useCallback } from "react";
import { Plus } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { agentApi } from "@/lib/api";
import { useChatStore } from "@/stores/chat-store";

interface ChatSessionListProps {
  projectId: string;
  canvasId?: string;
  onClose: () => void;
}

interface SessionItem {
  id: string;
  title: string | null;
  updated_at: string;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

export function ChatSessionList({
  projectId,
  canvasId,
  onClose,
}: ChatSessionListProps) {
  const currentSessionId = useChatStore((s) => s.sessionId);
  const setSession = useChatStore((s) => s.setSession);
  const queryClient = useQueryClient();

  const { data: sessions, isLoading } = useQuery<SessionItem[]>({
    queryKey: ["agent-sessions", projectId, canvasId],
    queryFn: () =>
      agentApi
        .listSessions(projectId, canvasId)
        .then((r) => r.data?.sessions ?? r.data ?? []),
  });

  const handleNewSession = useCallback(async () => {
    try {
      const res = await agentApi.createSession({
        project_id: projectId,
        canvas_id: canvasId,
      });
      const newId = res.data?.id ?? res.data?.session_id;
      if (newId) {
        setSession(newId);
        queryClient.invalidateQueries({
          queryKey: ["agent-sessions", projectId, canvasId],
        });
      }
      onClose();
    } catch {
      // creation failed — silently ignore
    }
  }, [projectId, canvasId, setSession, queryClient, onClose]);

  const handleSelectSession = useCallback(
    (id: string) => {
      setSession(id);
      onClose();
    },
    [setSession, onClose],
  );

  const visibleSessions = (sessions ?? [])
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )
    .slice(0, 8);

  return (
    <div className="absolute left-0 right-0 top-0 z-10 max-h-[400px] overflow-y-auto border-b border-gray-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
      {/* New session button */}
      <button
        onClick={handleNewSession}
        className="flex w-full items-center gap-2 border-b border-gray-100 px-4 py-3 text-sm text-indigo-600 transition-colors hover:bg-gray-50 dark:border-zinc-800 dark:text-indigo-400 dark:hover:bg-zinc-800"
      >
        <Plus className="h-4 w-4" />
        新对话
      </button>

      {isLoading && (
        <div className="space-y-1 p-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded bg-gray-100 dark:bg-zinc-800"
            />
          ))}
        </div>
      )}

      {!isLoading && visibleSessions.length === 0 && (
        <div className="px-4 py-6 text-center text-xs text-gray-400 dark:text-zinc-500">
          暂无历史会话
        </div>
      )}

      {!isLoading &&
        visibleSessions.map((session) => (
          <button
            key={session.id}
            onClick={() => handleSelectSession(session.id)}
            className={`flex w-full flex-col gap-0.5 px-4 py-3 text-left transition-colors hover:bg-gray-100 dark:hover:bg-zinc-800 ${
              session.id === currentSessionId
                ? "border-l-2 border-indigo-500 bg-gray-50 dark:bg-zinc-800/50"
                : ""
            }`}
          >
            <span
              className={`truncate text-sm ${
                session.id === currentSessionId
                  ? "font-semibold text-gray-900 dark:text-zinc-100"
                  : "text-gray-700 dark:text-zinc-300"
              }`}
            >
              {session.title || "未命名对话"}
            </span>
            <span className="text-xs text-gray-400 dark:text-zinc-500">
              {relativeTime(session.updated_at)}
            </span>
          </button>
        ))}
    </div>
  );
}
