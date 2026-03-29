"use client";
import { useMemo } from "react";
import { useNodes } from "@xyflow/react";
import { useUpstreamData } from "./use-upstream-data";

export interface PromptBuildResult {
  finalPrompt: string;
  upstreamImages: string[];
  upstreamVideos: string[];
  upstreamAudios: string[];
}

export function usePromptBuilder(nodeId: string): PromptBuildResult {
  const upstream = useUpstreamData(nodeId);
  const nodes = useNodes();

  return useMemo(() => {
    const node = nodes.find((n) => n.id === nodeId);
    const data = (node?.data ?? {}) as Record<string, unknown>;
    const parts: string[] = [];

    const hiddenPrompt = (data.config as Record<string, unknown>)?.hidden_prompt;
    if (typeof hiddenPrompt === "string" && hiddenPrompt) parts.push(hiddenPrompt);

    const nodePrompt = (data.text as string) || (data.prompt as string);
    if (nodePrompt) parts.push(nodePrompt);

    if (upstream.text.length > 0) parts.push(upstream.text.join("\n"));

    return {
      finalPrompt: parts.join("\n\n"),
      upstreamImages: upstream.imageUrl,
      upstreamVideos: upstream.videoUrl,
      upstreamAudios: upstream.audioUrl,
    };
  }, [nodeId, upstream, nodes]);
}
