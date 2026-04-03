"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Bot, Minus, X, Paperclip, Mic, ArrowUp, Square, Zap, MessageSquare } from "lucide-react";
import { useChatStore, type AgentMessage } from "@/stores/chat-store";
import { useAgentChat } from "@/hooks/use-agent-chat";
import { ChatSessionList } from "./chat-session-list";
import { ToolCallDisplay } from "./tool-call-display";
import { ThinkingIndicator } from "./thinking-indicator";
import { ModelSelector } from "@/components/common/model-selector";

interface AIChatPopupProps {
  projectId: string;
  canvasId?: string;
}

function formatTimestamp(ts: number) {
  return new Date(ts).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function shouldShowTime(prev: AgentMessage | undefined, curr: AgentMessage) {
  if (!prev) return true;
  return curr.timestamp - prev.timestamp > 5 * 60 * 1000;
}

function SuggestionChips({ onSend }: { onSend: (text: string) => void }) {
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
          style={{
            fontFamily: "Manrope, sans-serif",
            fontSize: 12,
            color: "var(--cv4-text-secondary)",
            background: "var(--cv4-surface-secondary)",
            border: "1px solid var(--cv4-border-default)",
            borderRadius: "var(--cv4-radius-tag)",
            padding: "8px 12px",
            cursor: "pointer",
            transition: "background 120ms",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--cv4-hover-highlight)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "var(--cv4-surface-secondary)"; }}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

export function AIChatPopup({ projectId, canvasId }: AIChatPopupProps) {
  const isOpen = useChatStore((s) => s.isOpen);
  const toggle = useChatStore((s) => s.toggle);
  const open = useChatStore((s) => s.open);
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const thinkingText = useChatStore((s) => s.thinkingText);
  const selectedModelName = useChatStore((s) => s.selectedModelName);
  const setSelectedModel = useChatStore((s) => s.setSelectedModel);
  const { sendMessage, abort } = useAgentChat();

  const [minimized, setMinimized] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);

  useEffect(() => {
    if (isOpen) open(projectId, canvasId);
  }, [projectId, canvasId, open, isOpen]);

  useEffect(() => {
    if (!userScrolled && messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, thinkingText, userScrolled]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) toggle();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, toggle]);

  const handleScroll = useCallback(() => {
    const el = messagesRef.current;
    if (!el) return;
    setUserScrolled(el.scrollHeight - el.scrollTop - el.clientHeight > 40);
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed || isStreaming) return;
    sendMessage(trimmed);
    setInputValue("");
    setUserScrolled(false);
  }, [inputValue, isStreaming, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  if (!isOpen) {
    return (
      <button
        onClick={toggle}
        style={{
          position: "fixed",
          right: 20,
          bottom: 20,
          width: 48,
          height: 48,
          borderRadius: 14,
          background: "var(--cv4-surface-primary)",
          border: "1px solid var(--cv4-border-default)",
          boxShadow: "var(--cv4-shadow-lg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 50,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          transition: "transform 120ms, box-shadow 120ms",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.05)"; e.currentTarget.style.boxShadow = "var(--cv4-shadow-xl)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "var(--cv4-shadow-lg)"; }}
        aria-label="打开 Cinematic AI"
        title="Cinematic AI"
      >
        <MessageSquare size={20} style={{ color: "var(--cv4-text-secondary)" }} />
      </button>
    );
  }

  const isEmpty = messages.length === 0 && !isStreaming && !thinkingText;

  return (
    <div
      ref={popupRef}
      role="dialog"
      aria-label="Cinematic AI"
      style={{
        position: "fixed",
        right: 16,
        top: 80,
        width: 400,
        height: minimized ? "auto" : "calc(100vh - 80px - 24px)",
        background: "var(--cv4-surface-popup)",
        borderRadius: "var(--cv4-radius-popup)",
        border: "1px solid var(--cv4-border-default)",
        boxShadow: "var(--cv4-shadow-xl)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        zIndex: 50,
        animation: "cv4-panel-enter 200ms ease-out",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--cv4-border-subtle)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: "var(--cv4-surface-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Bot size={16} style={{ color: "var(--cv4-text-secondary)" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 1, flex: 1 }}>
          <span style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 13, fontWeight: 700, color: "var(--cv4-text-primary)" }}>
            Cinematic AI
          </span>
          <span style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 9, color: "var(--cv4-text-muted)", letterSpacing: 1, opacity: 0.9 }}>
            Canvas Agent
          </span>
        </div>
        <button
          onClick={() => setMinimized((v) => !v)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
          aria-label="最小化"
        >
          <Minus size={14} style={{ color: "var(--cv4-text-disabled)" }} />
        </button>
        <button
          onClick={toggle}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
          aria-label="关闭"
        >
          <X size={14} style={{ color: "var(--cv4-text-disabled)" }} />
        </button>
      </div>

      {/* Session list dropdown */}
      {showSessions && (
        <div style={{ position: "relative" }}>
          <ChatSessionList
            projectId={projectId}
            canvasId={canvasId}
            onClose={() => setShowSessions(false)}
          />
        </div>
      )}

      {!minimized && (
        <>
          {/* Messages */}
          <div
            ref={messagesRef}
            onScroll={handleScroll}
            role="log"
            aria-live="polite"
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px 20px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {isEmpty ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 16, textAlign: "center", padding: "40px 16px" }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: "var(--cv4-surface-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Bot size={24} style={{ color: "var(--cv4-text-muted)" }} />
                </div>
                <span style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 13, fontWeight: 700, color: "var(--cv4-text-primary)" }}>
                  开始创作对话
                </span>
                <span style={{ fontFamily: "Manrope, sans-serif", fontSize: 12, color: "var(--cv4-text-muted)", lineHeight: 1.5 }}>
                  向 Cinematic AI 描述你的需求，它可以帮你生成剧本、提取角色、创建分镜等。
                </span>
                <SuggestionChips onSend={(text) => sendMessage(text)} />
              </div>
            ) : (
              <>
                {messages.map((msg, i) => (
                  <div key={msg.id}>
                    {shouldShowTime(messages[i - 1], msg) && (
                      <div style={{ textAlign: "center", fontSize: 9, color: "var(--cv4-text-disabled)", fontFamily: "Space Grotesk, sans-serif", padding: "4px 0" }}>
                        {formatTimestamp(msg.timestamp)}
                      </div>
                    )}

                    {msg.role === "user" && (
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <div
                          style={{
                            maxWidth: "85%",
                            background: "var(--cv4-surface-secondary)",
                            borderRadius: "12px 2px 12px 12px",
                            padding: "12px 16px",
                            fontFamily: "Manrope, sans-serif",
                            fontSize: 12,
                            lineHeight: 1.5,
                            color: "var(--cv4-text-primary)",
                          }}
                        >
                          {msg.content}
                        </div>
                      </div>
                    )}

                    {msg.role === "assistant" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <div
                          style={{
                            maxWidth: "85%",
                            background: "var(--cv4-surface-elevated)",
                            borderRadius: "2px 12px 12px 12px",
                            border: "1px solid var(--cv4-border-faint)",
                            padding: "12px 16px",
                            fontFamily: "Manrope, sans-serif",
                            fontSize: 12,
                            lineHeight: 1.5,
                            color: "var(--cv4-text-secondary)",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                          }}
                        >
                          {msg.content}
                          {isStreaming && i === messages.length - 1 && (
                            <span style={{ marginLeft: 2, color: "var(--cv4-text-muted)", animation: "cv4-panel-enter 600ms infinite alternate" }}>
                              ▍
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {(msg.role === "tool-call" || msg.role === "tool-result") && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                        <Zap size={11} style={{ color: "var(--cv4-text-secondary)" }} />
                        <span style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 9, fontWeight: 700, color: "var(--cv4-text-secondary)", letterSpacing: 1 }}>
                          EXECUTING
                        </span>
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

          {/* Input area */}
          <div
            style={{
              borderTop: "1px solid var(--cv4-border-subtle)",
              padding: "12px 20px 16px 20px",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                position: "relative",
                width: "100%",
                height: 80,
                background: "var(--cv4-surface-elevated)",
                borderRadius: 12,
                border: "1px solid var(--cv4-border-default)",
              }}
            >
              {/* Upload button */}
              <button
                style={{
                  position: "absolute",
                  left: 10,
                  top: 8,
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  background: "var(--cv4-surface-secondary)",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
                aria-label="上传附件"
              >
                <Paperclip size={14} style={{ color: "var(--cv4-text-disabled)" }} />
              </button>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="描述你的创作意图..."
                disabled={isStreaming}
                style={{
                  position: "absolute",
                  left: 46,
                  top: 8,
                  right: 12,
                  bottom: 40,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  resize: "none",
                  fontFamily: "Manrope, sans-serif",
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: "var(--cv4-text-primary)",
                }}
              />

              {/* Bottom bar: ModelSelector + Mic + Send */}
              <div
                style={{
                  position: "absolute",
                  left: 8,
                  right: 8,
                  bottom: 6,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <ModelSelector
                  value={selectedModelName}
                  onChange={setSelectedModel}
                  modelType="all"
                  requiredFeatures={["llm", "image"]}
                  size="sm"
                  disabled={isStreaming}
                />
                <span style={{ flex: 1 }} />
                <button
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 7,
                    background: "var(--cv4-surface-secondary)",
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                  aria-label="语音输入"
                >
                  <Mic size={14} style={{ color: "var(--cv4-text-disabled)" }} />
                </button>
                {isStreaming ? (
                  <button
                    onClick={abort}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 7,
                      background: "#EF4444",
                      border: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      boxShadow: "var(--cv4-shadow-sm)",
                      flexShrink: 0,
                    }}
                    aria-label="停止生成"
                  >
                    <Square size={12} style={{ color: "#fff" }} />
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
                    disabled={!inputValue.trim()}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 7,
                      background: inputValue.trim() ? "var(--cv4-btn-primary)" : "var(--cv4-surface-secondary)",
                      border: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: inputValue.trim() ? "pointer" : "not-allowed",
                      boxShadow: inputValue.trim() ? "var(--cv4-shadow-sm)" : "none",
                      transition: "background 120ms",
                      flexShrink: 0,
                    }}
                    aria-label="发送消息"
                  >
                    <ArrowUp size={14} style={{ color: inputValue.trim() ? "var(--cv4-btn-primary-text)" : "var(--cv4-text-disabled)" }} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
