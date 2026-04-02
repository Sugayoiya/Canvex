"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useReactFlow } from "@xyflow/react";
import { skillsApi, canvasApi } from "@/lib/api";
import { useCanvasStore } from "@/stores/canvas-store";
import { FEATURE_FLAGS, trackEndpointUsage } from "@/lib/feature-flags";

type NodeExecutionStatus =
  | "idle"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "timeout"
  | "blocked";

interface ExecutionState {
  status: NodeExecutionStatus;
  data: any;
  message: string;
  progress: number;
  idempotencyKey: string | null;
}

const INITIAL_POLL_INTERVAL = 3000;
const MAX_POLL_INTERVAL = 15000;
const MAX_POLL_ATTEMPTS = 60;
const BACKOFF_MULTIPLIER = 1.5;

export function useNodeExecution(nodeId: string, onComplete?: (data: any) => void) {
  const [state, setState] = useState<ExecutionState>({
    status: "idle",
    data: null,
    message: "",
    progress: 0,
    idempotencyKey: null,
  });
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollCountRef = useRef(0);
  const pollIntervalRef = useRef(INITIAL_POLL_INTERVAL);
  const isMountedRef = useRef(true);

  const { canvasId, projectId } = useCanvasStore();
  const { setNodes } = useReactFlow();

  const updateLocalNode = useCallback(
    (patch: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, ...patch } }
            : n,
        ),
      );
    },
    [nodeId, setNodes],
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, []);

  const pollResult = useCallback(async (taskId: string) => {
    if (!isMountedRef.current) return;
    if (pollCountRef.current >= MAX_POLL_ATTEMPTS) {
      setState((prev) => ({
        ...prev,
        status: "timeout",
        message: "轮询超时，请重试",
      }));
      const timeoutPatch = { status: "timeout", error_message: "轮询超时" };
      updateLocalNode(timeoutPatch);
      canvasApi.updateNode(nodeId, timeoutPatch).catch(() => {});
      return;
    }

    try {
      const res = await skillsApi.poll(taskId);
      if (!isMountedRef.current) return;
      const { status, data, message, progress } = res.data;

      if (status === "completed") {
        const resultText = typeof data === "string" ? data : (data?.text ?? data?.result ?? null);
        const resultUrl = data?.url ?? data?.result_url ?? null;
        setState({
          status: "completed",
          data,
          message: message ?? "",
          progress: 1,
          idempotencyKey: null,
        });
        const completedPatch = { status: "completed", result_text: resultText, result_url: resultUrl };
        updateLocalNode(completedPatch);
        canvasApi.updateNode(nodeId, completedPatch).catch((err) => {
          console.warn(`[useNodeExecution] writeback failed for node ${nodeId}:`, err);
        });
        onComplete?.(data);
        return;
      }
      if (status === "failed") {
        setState({
          status: "failed",
          data,
          message: message ?? "",
          progress: 0,
          idempotencyKey: null,
        });
        const failedPatch = { status: "failed", error_message: message ?? "execution failed" };
        updateLocalNode(failedPatch);
        canvasApi.updateNode(nodeId, failedPatch).catch((err) => {
          console.warn(`[useNodeExecution] writeback failed for node ${nodeId}:`, err);
        });
        return;
      }
      if (status === "blocked") {
        setState({
          status: "blocked",
          data,
          message: message || "内容安全策略拦截",
          progress: 0,
          idempotencyKey: null,
        });
        const blockedPatch = { status: "blocked", error_message: message || "内容安全策略拦截" };
        updateLocalNode(blockedPatch);
        canvasApi.updateNode(nodeId, blockedPatch).catch((err) => {
          console.warn(`[useNodeExecution] writeback failed for node ${nodeId}:`, err);
        });
        return;
      }

      setState((prev) => ({
        ...prev,
        progress: progress ?? prev.progress,
        message: message ?? prev.message,
      }));
      pollCountRef.current += 1;
      pollIntervalRef.current = Math.min(
        pollIntervalRef.current * BACKOFF_MULTIPLIER,
        MAX_POLL_INTERVAL,
      );
      pollTimerRef.current = setTimeout(
        () => pollResult(taskId),
        pollIntervalRef.current,
      );
    } catch (err: any) {
      if (!isMountedRef.current) return;
      setState((prev) => ({
        ...prev,
        status: "failed",
        message: `轮询出错: ${err?.message || "未知错误"}`,
      }));
    }
  }, [nodeId, onComplete]);

  /**
   * Execute a canvas node skill.
   *
   * Phase 12.1A: Uses skillsApi.invoke (legacy path).
   * Phase 12.1B (future): When AGENT_CHAT_FOR_CANVAS=true, will route through agent chat SSE.
   * Migration tracked via feature-flags.ts telemetry.
   */
  const execute = useCallback(
    async (skillName: string, params: Record<string, any> = {}) => {
      if (state.status === "running" || state.status === "queued") return;

      const idempotencyKey = `${nodeId}_${Date.now()}`;
      setState({
        status: "queued",
        data: null,
        message: "排队中...",
        progress: 0,
        idempotencyKey,
      });
      pollCountRef.current = 0;
      pollIntervalRef.current = INITIAL_POLL_INTERVAL;

      if (FEATURE_FLAGS.AGENT_CHAT_FOR_CANVAS) {
        trackEndpointUsage("agent/chat");
        // TODO(Phase 12.1B): Implement agent chat path for canvas nodes.
        // Requires: creating/reusing a canvas agent session, sending a
        // structured message, and parsing SSE response to update node state.
        console.warn(
          "[Canvas Migration] AGENT_CHAT_FOR_CANVAS is true but agent path not yet implemented — using legacy invoke",
        );
      }

      trackEndpointUsage("skills/invoke");

      try {
        const res = await skillsApi.invoke({
          skill_name: skillName,
          params,
          project_id: projectId ?? undefined,
          canvas_id: canvasId ?? undefined,
          node_id: nodeId,
          idempotency_key: idempotencyKey,
        });

        if (!isMountedRef.current) return;
        const { status, data, message, task_id } = res.data;

        if (status === "completed") {
          const rt = typeof data === "string" ? data : (data?.text ?? data?.result ?? null);
          const ru = data?.url ?? data?.result_url ?? null;
          setState((prev) => ({ ...prev, status: "completed", data, message: message ?? "", progress: 1 }));
          const patch = { status: "completed", result_text: rt, result_url: ru };
          updateLocalNode(patch);
          canvasApi.updateNode(nodeId, patch).catch((err) => {
            console.warn(`[useNodeExecution] writeback failed for node ${nodeId}:`, err);
          });
          onComplete?.(data);
        } else if (status === "failed") {
          setState((prev) => ({ ...prev, status: "failed", data, message: message ?? "", progress: 0 }));
          const patch = { status: "failed", error_message: message ?? "execution failed" };
          updateLocalNode(patch);
          canvasApi.updateNode(nodeId, patch).catch((err) => {
            console.warn(`[useNodeExecution] writeback failed for node ${nodeId}:`, err);
          });
        } else if (status === "blocked") {
          setState((prev) => ({ ...prev, status: "blocked", data, message: message || "内容安全策略拦截", progress: 0 }));
          const patch = { status: "blocked", error_message: message || "内容安全策略拦截" };
          updateLocalNode(patch);
          canvasApi.updateNode(nodeId, patch).catch((err) => {
            console.warn(`[useNodeExecution] writeback failed for node ${nodeId}:`, err);
          });
        } else if (task_id) {
          setState((prev) => ({
            ...prev,
            status: "running",
            message: "执行中...",
          }));
          pollTimerRef.current = setTimeout(
            () => pollResult(task_id),
            INITIAL_POLL_INTERVAL,
          );
        }
      } catch (err: any) {
        if (!isMountedRef.current) return;
        setState({
          status: "failed",
          data: null,
          message: `调用失败: ${err?.message || "未知错误"}`,
          progress: 0,
          idempotencyKey: null,
        });
      }
    },
    [nodeId, canvasId, projectId, pollResult, updateLocalNode, state.status, onComplete],
  );

  const reset = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setState({
      status: "idle",
      data: null,
      message: "",
      progress: 0,
      idempotencyKey: null,
    });
  }, []);

  return { ...state, execute, reset };
}
