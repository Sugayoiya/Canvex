"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { canvasApi } from "@/lib/api";
import { CanvasWorkspace } from "@/components/canvas/canvas-workspace";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { useChatStore } from "@/stores/chat-store";

export default function CanvasPage() {
  const { id: canvasId } = useParams<{ id: string }>();
  const isOpen = useChatStore((s) => s.isOpen);
  const [isOverlayMode, setIsOverlayMode] = useState(false);

  useEffect(() => {
    const check = () => setIsOverlayMode(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

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
    <div className="h-screen w-screen overflow-hidden flex">
      <div
        className={`flex-1 transition-all duration-200 ${isOpen && !isOverlayMode ? "mr-[380px]" : ""}`}
      >
        <CanvasWorkspace canvasId={canvasId} initialData={canvas} />
      </div>
      <ChatSidebar projectId={canvas.project_id} canvasId={canvasId} />
    </div>
  );
}
