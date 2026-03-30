"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { useOnSelectionChange, useReactFlow, type Node } from "@xyflow/react";
import { canvasApi } from "@/lib/api";
import { useCanvasStore } from "@/stores/canvas-store";

type BatchState = "idle" | "executing" | "complete";

const BASE_POLL_INTERVAL = 3000;
const MAX_POLL_INTERVAL = 30000;

export function useBatchExecution() {
  const [selectedNodes, setSelectedNodes] = useState<Node[]>([]);
  const [batchState, setBatchState] = useState<BatchState>("idle");
  const [batchId, setBatchId] = useState<string | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const prevSelectionRef = useRef<string[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollIntervalRef = useRef(BASE_POLL_INTERVAL);

  const { canvasId } = useCanvasStore();
  const { setNodes, getNodes } = useReactFlow();

  const onChange = useCallback(({ nodes }: { nodes: Node[] }) => {
    const newIds = nodes.map((n) => n.id).sort();
    const prevIds = prevSelectionRef.current;

    if (
      newIds.length === prevIds.length &&
      newIds.every((id, i) => id === prevIds[i])
    ) {
      return;
    }

    prevSelectionRef.current = newIds;
    setSelectedNodes(nodes);
  }, []);

  useOnSelectionChange({ onChange });

  useEffect(() => {
    if (batchState !== "executing" || !batchId) return;

    const poll = async () => {
      if (document.hidden) return;

      try {
        const res = await canvasApi.batchStatus(batchId);
        const { node_statuses, status } = res.data;
        const terminalStates = ["completed", "failed", "blocked", "timeout"];
        const completed = Object.values(node_statuses as Record<string, string>).filter(
          (s) => terminalStates.includes(s),
        ).length;
        setCompletedCount(completed);

        pollIntervalRef.current = BASE_POLL_INTERVAL;

        if (status === "completed" || status === "failed") {
          setBatchState("complete");
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }

          const allNodes = getNodes();
          setNodes(
            allNodes.map((n) => {
              const nodeStatus = (node_statuses as Record<string, string>)[n.id];
              if (nodeStatus) {
                return { ...n, data: { ...n.data, status: nodeStatus } };
              }
              return n;
            }),
          );
        }
      } catch {
        pollIntervalRef.current = Math.min(
          pollIntervalRef.current * 2,
          MAX_POLL_INTERVAL,
        );
      }
    };

    pollRef.current = setInterval(poll, pollIntervalRef.current);
    poll();

    const onVisibilityChange = () => {
      if (!document.hidden && batchState === "executing") {
        poll();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [batchState, batchId, getNodes, setNodes]);

  const canBatchExecute = selectedNodes.length > 1;

  const executeBatch = useCallback(async () => {
    if (!canvasId || selectedNodes.length < 2) return;

    setBatchState("executing");
    const nodeIds = selectedNodes.map((n) => n.id);
    setTotalCount(nodeIds.length);
    setCompletedCount(0);
    pollIntervalRef.current = BASE_POLL_INTERVAL;

    try {
      const res = await canvasApi.batchExecute({
        canvas_id: canvasId,
        node_ids: nodeIds,
      });
      const { batch_id, total_nodes } = res.data;
      setBatchId(batch_id);
      setTotalCount(total_nodes ?? nodeIds.length);

      setNodes((nds) =>
        nds.map((n) =>
          nodeIds.includes(n.id)
            ? { ...n, data: { ...n.data, status: "queued" } }
            : n,
        ),
      );
    } catch {
      setBatchState("idle");
    }
  }, [canvasId, selectedNodes, setNodes]);

  const clearSelection = useCallback(() => {
    prevSelectionRef.current = [];
    setSelectedNodes([]);
    setNodes((nds) =>
      nds.map((n) => ({ ...n, selected: false })),
    );
  }, [setNodes]);

  const dismissBar = useCallback(() => {
    setBatchState("idle");
    setBatchId(null);
    setCompletedCount(0);
    setTotalCount(0);
  }, []);

  return {
    selectedNodes,
    canBatchExecute,
    batchState,
    executeBatch,
    clearSelection,
    dismissBar,
    completedCount,
    totalCount,
  };
}
