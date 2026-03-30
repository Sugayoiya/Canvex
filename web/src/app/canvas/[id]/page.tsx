"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { canvasApi } from "@/lib/api";

export default function CanvasRedirectPage() {
  const { id: canvasId } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: canvas } = useQuery({
    queryKey: ["canvas", canvasId],
    queryFn: () => canvasApi.get(canvasId).then((res) => res.data),
    enabled: !!canvasId,
  });

  useEffect(() => {
    if (canvas?.project_id) {
      router.replace(`/projects/${canvas.project_id}/canvas/${canvasId}`);
    }
  }, [canvas, canvasId, router]);

  return (
    <div className="flex h-screen items-center justify-center text-gray-500">
      跳转中…
    </div>
  );
}
