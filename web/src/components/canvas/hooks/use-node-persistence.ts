"use client";

import { useCallback, useEffect, useRef } from "react";
import { canvasApi } from "@/lib/api";
import { getAccessToken } from "@/stores/auth-store";

const DEBOUNCE_MS = 2000;

export function useNodePersistence(nodeId: string) {
  const isSavingRef = useRef(false);
  const needsSaveRef = useRef(false);
  const pendingDataRef = useRef<Record<string, unknown> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSave = useCallback(
    async (data: Record<string, unknown>) => {
      if (isSavingRef.current) {
        needsSaveRef.current = true;
        pendingDataRef.current = data;
        return;
      }
      isSavingRef.current = true;
      try {
        await canvasApi.updateNode(nodeId, data);
      } catch (err) {
        console.warn(
          `[useNodePersistence] save failed for node ${nodeId}:`,
          err,
        );
      } finally {
        isSavingRef.current = false;
        if (needsSaveRef.current && pendingDataRef.current) {
          needsSaveRef.current = false;
          const next = pendingDataRef.current;
          pendingDataRef.current = null;
          doSave(next);
        }
      }
    },
    [nodeId],
  );

  const saveDebounced = useCallback(
    (data: Record<string, unknown>) => {
      pendingDataRef.current = data;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (pendingDataRef.current) {
          doSave(pendingDataRef.current);
        }
      }, DEBOUNCE_MS);
    },
    [doSave],
  );

  const saveImmediate = useCallback(
    (data: Record<string, unknown>) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      pendingDataRef.current = null;
      doSave(data);
    },
    [doSave],
  );

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (pendingDataRef.current) {
      doSave(pendingDataRef.current);
      pendingDataRef.current = null;
    }
  }, [doSave]);

  const cancelPending = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingDataRef.current = null;
    needsSaveRef.current = false;
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (pendingDataRef.current) {
        const token = getAccessToken();
        const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
        fetch(`${baseUrl}/api/v1/canvas/nodes/${nodeId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(pendingDataRef.current),
          keepalive: true,
        });
        pendingDataRef.current = null;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [nodeId]);

  return {
    saveDebounced,
    saveImmediate,
    flush,
    cancelPending,
    isSaving: isSavingRef,
  };
}
