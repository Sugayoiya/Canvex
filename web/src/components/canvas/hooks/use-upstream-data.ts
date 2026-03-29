"use client";

import { useMemo } from "react";
import { useEdges, useNodes } from "@xyflow/react";

export interface UpstreamData {
  text: string[];
  json: object[];
  imageUrl: string[];
  videoUrl: string[];
  audioUrl: string[];
}

const EMPTY: UpstreamData = { text: [], json: [], imageUrl: [], videoUrl: [], audioUrl: [] };

export function useUpstreamData(nodeId: string): UpstreamData {
  const edges = useEdges();
  const nodes = useNodes();

  return useMemo(() => {
    const incoming = edges.filter((e) => e.target === nodeId);
    if (incoming.length === 0) return EMPTY;

    // Stable ordering: sort by source node ID so multi-upstream aggregation
    // produces consistent array indices regardless of edge creation order.
    const sorted = [...incoming].sort((a, b) =>
      a.source.localeCompare(b.source),
    );

    const result: UpstreamData = { text: [], json: [], imageUrl: [], videoUrl: [], audioUrl: [] };

    for (const edge of sorted) {
      const src = nodes.find((n) => n.id === edge.source);
      if (!src) continue;
      const d = src.data as Record<string, unknown>;

      if (typeof d.text === "string" && d.text) result.text.push(d.text);
      if (typeof d.result_text === "string" && d.result_text)
        result.text.push(d.result_text);

      if (d.result_data && typeof d.result_data === "object")
        result.json.push(d.result_data as object);

      if (typeof d.result_url === "string" && d.result_url)
        result.imageUrl.push(d.result_url);

      if (typeof d.result_video_url === "string" && d.result_video_url)
        result.videoUrl.push(d.result_video_url);

      if (typeof d.result_audio_url === "string" && d.result_audio_url)
        result.audioUrl.push(d.result_audio_url);
    }

    return result;
  }, [nodeId, edges, nodes]);
}
