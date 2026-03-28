"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useChatStore, type AgentMessage } from "@/stores/chat-store";
import { useAgentChat } from "@/hooks/use-agent-chat";
import { ToolCallDisplay } from "./tool-call-display";
import { ThinkingIndicator } from "./thinking-indicator";

function formatTimestamp(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function shouldShowTime(prev: AgentMessage | undefined, curr: AgentMessage) {
  if (!prev) return true;
  return curr.timestamp - prev.timestamp > 5 * 60 * 1000;
}

interface SuggestionChipsProps {
  onSend: (text: string) => void;
}

function SuggestionChips({ onSend }: SuggestionChipsProps) {
  const suggestions = [
    "帮我生成一个剧本大纲",
    "提取这个故事的角色",
    "创建完整的分镜流程",
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {suggestions.map((s) => (
        <button
          key={s}
          onClick={() => onSend(s)}
          className="rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

export function ChatMessages() {
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const thinkingText = useChatStore((s) => s.thinkingText);
  const { sendMessage } = useAgentChat();
  const containerRef = useRef<HTMLDivElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);

  const scrollToBottom = useCallback(() => {
    if (!userScrolled && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [userScrolled]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, thinkingText, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setUserScrolled(!atBottom);
  }, []);

  const handleSuggestionSend = useCallback(
    (text: string) => {
      sendMessage(text);
    },
    [sendMessage],
  );

  const isEmpty = messages.length === 0 && !isStreaming && !thinkingText;

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      role="log"
      aria-live="polite"
      onScroll={handleScroll}
    >
      {isEmpty ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
          <h3 className="text-base font-semibold text-gray-900 dark:text-zinc-100">
            开始对话
          </h3>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            向 AI 助手描述你的需求，它可以帮你生成剧本、提取角色、创建分镜等。
          </p>
          <SuggestionChips onSend={handleSuggestionSend} />
        </div>
      ) : (
        <>
          {messages.map((msg, i) => (
            <div key={msg.id}>
              {shouldShowTime(messages[i - 1], msg) && (
                <div className="py-1 text-center text-xs text-gray-400 dark:text-zinc-500">
                  {formatTimestamp(msg.timestamp)}
                </div>
              )}

              {msg.role === "user" && (
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-gray-100 px-3 py-2 text-sm text-gray-900 dark:bg-zinc-800 dark:text-zinc-100">
                    {msg.content}
                  </div>
                </div>
              )}

              {msg.role === "assistant" && (
                <div className="text-sm text-gray-800 dark:text-zinc-200">
                  {msg.content}
                  {isStreaming && i === messages.length - 1 && (
                    <span className="ml-0.5 inline-block animate-pulse text-indigo-500 dark:text-indigo-400">
                      ▍
                    </span>
                  )}
                </div>
              )}

              {(msg.role === "tool-call" || msg.role === "tool-result") && (
                <ToolCallDisplay message={msg} />
              )}
            </div>
          ))}

          {thinkingText && !isStreaming && <ThinkingIndicator text={thinkingText} />}
        </>
      )}
    </div>
  );
}
