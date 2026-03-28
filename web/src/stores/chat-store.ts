import { create } from "zustand";

export interface ToolCallData {
  tool: string;
  args: Record<string, unknown>;
  callId: string;
}

export interface ToolResultData {
  tool: string;
  summary: string;
  callId: string;
  success: boolean;
  data?: Record<string, unknown>;
}

export interface AgentMessage {
  id: string;
  role: "user" | "assistant" | "tool-call" | "tool-result";
  content: string;
  toolCalls?: ToolCallData[];
  toolResults?: ToolResultData[];
  timestamp: number;
}

interface ChatState {
  isOpen: boolean;
  sessionId: string | null;
  projectId: string | null;
  canvasId: string | null;
  messages: AgentMessage[];
  isStreaming: boolean;
  thinkingText: string | null;
  lastRequestId: string | null;

  toggle: () => void;
  open: (projectId: string, canvasId?: string) => void;
  close: () => void;
  setSession: (sessionId: string) => void;
  addMessage: (message: AgentMessage) => void;
  updateLastMessage: (content: string) => void;
  completeToolCall: (callId: string, result: ToolResultData) => void;
  setStreaming: (streaming: boolean) => void;
  setThinkingText: (text: string | null) => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>()((set) => ({
  isOpen: false,
  sessionId: null,
  projectId: null,
  canvasId: null,
  messages: [],
  isStreaming: false,
  thinkingText: null,
  lastRequestId: null,

  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  open: (projectId, canvasId) =>
    set({ isOpen: true, projectId, canvasId: canvasId ?? null }),
  close: () => set({ isOpen: false }),
  setSession: (sessionId) => set({ sessionId, messages: [] }),
  addMessage: (message) =>
    set((s) => ({ messages: [...s.messages, message] })),
  updateLastMessage: (content) =>
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last && last.role === "assistant") {
        msgs[msgs.length - 1] = { ...last, content };
      }
      return { messages: msgs };
    }),
  completeToolCall: (callId, result) =>
    set((s) => ({
      messages: s.messages.map((m) => {
        if (m.role !== "tool-call") return m;
        if (!m.toolCalls?.some((tc) => tc.callId === callId)) return m;
        return { ...m, toolResults: [result] };
      }),
    })),
  setStreaming: (streaming) => set({ isStreaming: streaming }),
  setThinkingText: (text) => set({ thinkingText: text }),
  reset: () =>
    set({
      sessionId: null,
      messages: [],
      isStreaming: false,
      thinkingText: null,
      lastRequestId: null,
    }),
}));
