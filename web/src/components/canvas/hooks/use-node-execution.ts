"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { skillsApi, canvasApi } from "@/lib/api";
import { useCanvasStore } from "@/stores/canvas-store";

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
      canvasApi.updateNode(nodeId, {
        status: "timeout",
        error_message: "轮询超时",
      }).catch(() => {});
      return;
    }

    try {
      const res = await skillsApi.poll(taskId);
      if (!isMountedRef.current) return;
      const { status, data, message, progress } = res.data;

      if (status === "completed") {
        setState({
          status: "completed",
          data,
          message: message ?? "",
          progress: 1,
          idempotencyKey: null,
        });
        canvasApi.updateNode(nodeId, {
          status: "completed",
          result_text: typeof data === "string" ? data : (data?.text ?? data?.result ?? null),
          result_url: data?.url ?? data?.result_url ?? null,
        }).catch((err) => {
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
        canvasApi.updateNode(nodeId, {
          status: "failed",
          error_message: message ?? "execution failed",
        }).catch((err) => {
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
        canvasApi.updateNode(nodeId, {
          status: "blocked",
          error_message: message || "内容安全策略拦截",
        }).catch((err) => {
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
          setState((prev) => ({
            ...prev,
            status: "completed",
            data,
            message: message ?? "",
            progress: 1,
          }));
          canvasApi.updateNode(nodeId, {
            status: "completed",
            result_text: typeof data === "string" ? data : (data?.text ?? data?.result ?? null),
            result_url: data?.url ?? data?.result_url ?? null,
          }).catch((err) => {
            console.warn(`[useNodeExecution] writeback failed for node ${nodeId}:`, err);
          });
          onComplete?.(data);
        } else if (status === "failed") {
          setState((prev) => ({
            ...prev,
            status: "failed",
            data,
            message: message ?? "",
            progress: 0,
          }));
          canvasApi.updateNode(nodeId, {
            status: "failed",
            error_message: message ?? "execution failed",
          }).catch((err) => {
            console.warn(`[useNodeExecution] writeback failed for node ${nodeId}:`, err);
          });
        } else if (status === "blocked") {
          setState((prev) => ({
            ...prev,
            status: "blocked",
            data,
            message: message || "内容安全策略拦截",
            progress: 0,
          }));
          canvasApi.updateNode(nodeId, {
            status: "blocked",
            error_message: message || "内容安全策略拦截",
          }).catch((err) => {
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
    [nodeId, canvasId, projectId, pollResult, state.status, onComplete],
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
