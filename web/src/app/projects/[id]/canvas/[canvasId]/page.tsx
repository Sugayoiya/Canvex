"use client";

import { ArrowLeft } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { canvasApi } from "@/lib/api";
import { CanvasWorkspace } from "@/components/canvas/canvas-workspace";
import { AIChatPopup } from "@/components/chat/ai-chat-popup";

export default function ProjectCanvasPage() {
  const router = useRouter();
  const { id: projectId, canvasId } = useParams<{
    id: string;
    canvasId: string;
  }>();

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
    <div className="relative h-screen w-screen overflow-hidden">
      <button
        type="button"
        onClick={() => router.push(`/projects/${projectId || canvas?.project_id}`)}
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          zIndex: 40,
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          borderRadius: 14,
          border: "1px solid var(--cv4-border-default)",
          background: "color-mix(in srgb, var(--cv4-surface-popup) 86%, transparent)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          boxShadow: "var(--cv4-shadow-lg)",
          color: "var(--cv4-text-primary)",
          cursor: "pointer",
          transition: "transform 120ms ease, border-color 120ms ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.borderColor = "rgba(0,209,255,0.28)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.borderColor = "var(--cv4-border-default)";
        }}
        aria-label="返回项目详情"
      >
        <ArrowLeft size={16} style={{ color: "var(--cv4-text-secondary)" }} />
        <span
          style={{
            fontFamily: "Space Grotesk, sans-serif",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          返回上一层
        </span>
      </button>
      <CanvasWorkspace canvasId={canvasId} initialData={canvas} />
      <AIChatPopup
        projectId={projectId || canvas?.project_id}
        canvasId={canvasId}
      />
    </div>
  );
}
