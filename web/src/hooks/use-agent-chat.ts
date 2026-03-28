import { useCallback, useRef } from "react";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import {
  useChatStore,
  type AgentMessage,
  type ToolCallData,
  type ToolResultData,
} from "@/stores/chat-store";
import { API_BASE_URL } from "@/lib/api";

export function useAgentChat() {
  const abortRef = useRef<AbortController | null>(null);
  const isStreaming = useChatStore((s) => s.isStreaming);

  const sendMessage = useCallback(async (content: string) => {
    const {
      sessionId,
      addMessage,
      updateLastMessage,
      setStreaming,
      setThinkingText,
    } = useChatStore.getState();
    if (!sessionId || !content.trim()) return;

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

    try {
      await fetchEventSource(
        `${API_BASE_URL}/api/v1/agent/chat/${sessionId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
          body: JSON.stringify({ message: content.trim() }),
          signal: controller.signal,

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
                    : "正在规划接下来的步骤…"
                );
                break;

              case "tool_call": {
                setThinkingText(null);
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
                };
                const trMsg: AgentMessage = {
                  id: `tr-${data.call_id}`,
                  role: "tool-result",
                  content: data.summary,
                  toolResults: [toolResult],
                  timestamp: Date.now(),
                };
                addMessage(trMsg);
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
                break;

              case "error":
                setThinkingText(null);
                addMessage({
                  id: `err-${Date.now()}`,
                  role: "assistant",
                  content: `❌ ${data.message}`,
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
          },

          onerror(err) {
            setStreaming(false);
            setThinkingText(null);
            throw err;
          },

          openWhenHidden: true,
        }
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // User cancelled — normal flow
      } else {
        console.error("Agent chat error:", err);
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
