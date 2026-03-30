"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { canvasApi } from "@/lib/api";
import { CanvasWorkspace } from "@/components/canvas/canvas-workspace";
import { AIChatPopup } from "@/components/chat/ai-chat-popup";

export default function CanvasPage() {
  const { id: canvasId } = useParams<{ id: string }>();

  const {
    data: canvas,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["canvas", canvasId],
    queryFn: () => canvasApi.get(canvasId).then((res) => res.data),
    enabled: !!canvasId,
  });

  if (!canvasId) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-500">
        缺少画布 ID
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-500">
        加载画布中…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center text-red-500">
        加载失败：{(error as Error).message}
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden">
      <CanvasWorkspace canvasId={canvasId} initialData={canvas} />
      <AIChatPopup projectId={canvas.project_id} canvasId={canvasId} />
    </div>
  );
}
