import { useCallback, useRef } from "react";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import axios from "axios";
import {
  useChatStore,
  type AgentMessage,
  type ToolCallData,
  type ToolResultData,
} from "@/stores/chat-store";
import { API_BASE_URL, agentApi } from "@/lib/api";
import { getAccessToken, getRefreshToken, useAuthStore } from "@/stores/auth-store";

class StreamClosedError extends Error {
  constructor() {
    super("SSE stream closed normally");
    this.name = "StreamClosedError";
  }
}

async function getFreshAccessToken(): Promise<string | null> {
  let token = getAccessToken();
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const expiresAt = payload.exp * 1000;
    const bufferMs = 60_000;
    if (Date.now() < expiresAt - bufferMs) return token;
  } catch {
    return token;
  }

  const refreshToken = getRefreshToken();
  if (!refreshToken) return token;

  try {
    const { data } = await axios.post(
      `${API_BASE_URL}/api/v1/auth/refresh`,
      { refresh_token: refreshToken },
    );
    useAuthStore.getState().setTokens(data.access_token, data.refresh_token);
    return data.access_token;
  } catch {
    return token;
  }
}

export function useAgentChat() {
  const abortRef = useRef<AbortController | null>(null);
  const isStreaming = useChatStore((s) => s.isStreaming);

  const sendMessage = useCallback(async (content: string) => {
    const store = useChatStore.getState();
    let { sessionId } = store;
    const {
      projectId,
      canvasId,
      addMessage,
      updateLastMessage,
      setStreaming,
      setThinkingText,
      setSession,
    } = store;

    if (!content.trim()) return;

    if (!sessionId) {
      if (!projectId) return;
      try {
        const res = await agentApi.createSession({
          project_id: projectId,
          canvas_id: canvasId ?? undefined,
        });
        const newId = res.data?.id ?? res.data?.session_id;
        if (!newId) return;
        setSession(newId);
        sessionId = newId;
      } catch (err) {
        console.error("Failed to auto-create chat session:", err);
        return;
      }
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setStreaming(true);
    setThinkingText(null);

    const userMsg: AgentMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: content.trim(),
      timestamp: Date.now(),
    };
    addMessage(userMsg);

    let assistantContent = "";
    let hasAssistantMessage = false;
    let currentRequestId: string | null = null;

    const accessToken = await getFreshAccessToken();

    try {
      await fetchEventSource(
        `${API_BASE_URL}/api/v1/agent/chat/${sessionId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ message: content.trim() }),
          signal: controller.signal,

          async onopen(response) {
            if (response.ok) return;
            if (response.status === 401) {
              throw new Error("认证已过期，请重新登录");
            }
            throw new Error(`服务器返回 ${response.status}`);
          },

          onmessage(ev) {
            if (!ev.data) return;
            const data = JSON.parse(ev.data);

            if (data.request_id) {
              if (!currentRequestId) {
                currentRequestId = data.request_id;
              } else if (data.request_id !== currentRequestId) {
                return;
              }
            }

            switch (ev.event) {
              case "thinking":
                setThinkingText(
                  data.status === "analyzing"
                    ? "正在分析你的需求…"
                    : data.status === "executing tools"
                      ? "正在执行工具调用…"
                      : "正在规划接下来的步骤…",
                );
                break;

              case "tool_call": {
                setThinkingText("正在执行工具调用…");
                const toolCall: ToolCallData = {
                  tool: data.tool,
                  args: data.args,
                  callId: data.call_id,
                };
                const tcMsg: AgentMessage = {
                  id: `tc-${data.call_id}`,
                  role: "tool-call",
                  content: `调用 ${data.tool}`,
                  toolCalls: [toolCall],
                  timestamp: Date.now(),
                };
                addMessage(tcMsg);
                break;
              }

              case "tool_result": {
                const toolResult: ToolResultData = {
                  tool: data.tool,
                  summary: data.summary,
                  callId: data.call_id,
                  success: data.success,
                  data: data.data,
                };
                useChatStore.getState().completeToolCall(data.call_id, toolResult);
                break;
              }

              case "token":
                setThinkingText(null);
                assistantContent += data.text;
                if (!hasAssistantMessage) {
                  hasAssistantMessage = true;
                  addMessage({
                    id: `asst-${Date.now()}`,
                    role: "assistant",
                    content: assistantContent,
                    timestamp: Date.now(),
                  });
                } else {
                  updateLastMessage(assistantContent);
                }
                break;

              case "done":
                setThinkingText(null);
                setStreaming(false);
                break;

              case "error":
                setThinkingText(null);
                addMessage({
                  id: `err-${Date.now()}`,
                  role: "assistant",
                  content: `${data.message}`,
                  timestamp: Date.now(),
                });
                break;

              case "heartbeat":
                break;
            }
          },

          onclose() {
            setStreaming(false);
            setThinkingText(null);
            throw new StreamClosedError();
          },

          onerror(err) {
            setStreaming(false);
            setThinkingText(null);
            throw err;
          },

          openWhenHidden: true,
        },
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // User cancelled
      } else if (err instanceof StreamClosedError) {
        // Normal completion — not an error
      } else {
        console.error("Agent chat error:", err);
        if (
          err instanceof Error &&
          err.message.includes("认证已过期")
        ) {
          addMessage({
            id: `err-${Date.now()}`,
            role: "assistant",
            content: "认证已过期，请刷新页面重新登录。",
            timestamp: Date.now(),
          });
        }
      }
    } finally {
      setStreaming(false);
      setThinkingText(null);
      abortRef.current = null;
    }
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    useChatStore.getState().setStreaming(false);
    useChatStore.getState().setThinkingText(null);
  }, []);

  return { sendMessage, abort, isStreaming };
}
