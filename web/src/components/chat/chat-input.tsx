"use client";

import { useRef, useState, useCallback } from "react";
import { SendHorizontal, Square } from "lucide-react";
import { useAgentChat } from "@/hooks/use-agent-chat";

export function ChatInput() {
  const { sendMessage, abort, isStreaming } = useAgentChat();
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming) return;
    sendMessage(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, isStreaming, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className="flex items-end gap-2 border-t border-gray-200 px-3 py-2 dark:border-zinc-800">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          adjustHeight();
        }}
        onKeyDown={handleKeyDown}
        placeholder="向 AI 助手发送消息..."
        disabled={isStreaming}
        rows={1}
        className="min-h-[44px] max-h-[120px] flex-1 resize-none rounded-lg bg-white px-3 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:ring-indigo-400"
      />

      {isStreaming ? (
        <button
          onClick={abort}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500 text-white transition-colors hover:bg-red-600"
          aria-label="停止生成"
          title="停止生成"
        >
          <Square className="h-4 w-4" />
        </button>
      ) : (
        <button
          onClick={handleSend}
          disabled={!value.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white transition-colors hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed dark:bg-indigo-500 dark:hover:bg-indigo-600"
          aria-label="发送消息"
          title="发送消息"
        >
          <SendHorizontal className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
