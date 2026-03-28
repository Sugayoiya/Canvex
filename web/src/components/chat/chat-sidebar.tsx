"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { MessageSquare, X, List } from "lucide-react";
import { useChatStore } from "@/stores/chat-store";
import { ChatMessages } from "./chat-messages";
import { ChatInput } from "./chat-input";
import { ChatSessionList } from "./chat-session-list";

interface ChatSidebarProps {
  projectId: string;
  canvasId?: string;
}

export function ChatSidebar({ projectId, canvasId }: ChatSidebarProps) {
  const isOpen = useChatStore((s) => s.isOpen);
  const toggle = useChatStore((s) => s.toggle);
  const open = useChatStore((s) => s.open);
  const [showSessions, setShowSessions] = useState(false);
  const [isOverlay, setIsOverlay] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    open(projectId, canvasId);
  }, [projectId, canvasId, open]);

  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      setIsOverlay(w < 1024);
      setIsMobile(w < 768);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        toggle();
      }
    },
    [isOpen, toggle],
  );

  return (
    <>
      {/* Backdrop for overlay mode */}
      {isOpen && isOverlay && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={toggle}
          aria-hidden="true"
        />
      )}

      {/* Toggle button — visible when sidebar closed */}
      {!isOpen && (
        <button
          onClick={toggle}
          className="fixed right-4 top-1/2 z-40 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg bg-white shadow-md transition-colors hover:bg-gray-100 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          aria-label="打开 AI 助手"
          title="打开 AI 助手"
        >
          <MessageSquare className="h-5 w-5 text-gray-600 dark:text-zinc-300" />
        </button>
      )}

      {/* Sidebar panel */}
      <div
        ref={panelRef}
        role="complementary"
        aria-label="AI 助手"
        onKeyDown={handleKeyDown}
        className={`fixed right-0 top-0 h-full flex flex-col border-l border-gray-200 bg-gray-50 transition-transform duration-200 ease-out dark:border-zinc-800 dark:bg-zinc-900 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        } ${isMobile ? "z-50 w-full" : "z-50 w-[380px]"} ${isOverlay ? "z-50" : "z-40"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-100">
            AI 助手
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSessions((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-gray-200 dark:hover:bg-zinc-700"
              aria-label="会话列表"
              title="会话列表"
            >
              <List className="h-4 w-4 text-gray-500 dark:text-zinc-400" />
            </button>
            <button
              onClick={toggle}
              className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-gray-200 dark:hover:bg-zinc-700"
              aria-label="关闭 AI 助手"
              title="关闭 AI 助手"
            >
              <X className="h-4 w-4 text-gray-500 dark:text-zinc-400" />
            </button>
          </div>
        </div>

        {/* Session list dropdown */}
        <div className="relative">
          {showSessions && (
            <ChatSessionList
              projectId={projectId}
              canvasId={canvasId}
              onClose={() => setShowSessions(false)}
            />
          )}
        </div>

        {/* Messages */}
        <ChatMessages />

        {/* Input */}
        <ChatInput />
      </div>
    </>
  );
}
