"use client";

import { useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Monitor } from "lucide-react";

export function OutputNode({ data }: NodeProps) {
  const nodeData = data as Record<string, unknown>;
  const [imgError, setImgError] = useState(false);

  const text = (nodeData.text as string) ?? "";
  const jsonData = nodeData.json ?? nodeData.data ?? null;
  const imageUrl = (nodeData.imageUrl as string) ?? (nodeData.image_url as string) ?? "";

  const hasContent = text || jsonData || imageUrl;

  return (
    <div className="min-w-[200px] max-w-[320px] rounded-lg border border-zinc-700 bg-zinc-800 shadow-md">
      <div className="flex items-center gap-2 border-b border-zinc-700 px-3 py-2">
        <Monitor className="h-3.5 w-3.5 text-zinc-400" />
        <span className="text-xs font-medium text-zinc-200">输出</span>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="!h-3 !w-3 !border-2 !border-zinc-600 !bg-cyan-500"
      />

      <div className="max-h-[300px] overflow-auto p-3">
        {!hasContent && (
          <div className="flex flex-col items-center justify-center py-6 text-zinc-500">
            <Monitor className="mb-1 h-6 w-6" />
            <span className="text-[10px]">等待输入数据</span>
          </div>
        )}

        {imageUrl && !imgError && (
          <div className="mb-2 overflow-hidden rounded-md">
            <img
              src={imageUrl}
              alt="输出图片"
              className="w-full object-contain"
              onError={() => setImgError(true)}
            />
          </div>
        )}

        {text && (
          <div className="whitespace-pre-wrap text-xs text-zinc-300">
            {text}
          </div>
        )}

        {jsonData && typeof jsonData === "object" && (
          <pre className="overflow-auto whitespace-pre-wrap rounded-md bg-zinc-900 p-2 text-[10px] text-zinc-300">
            {JSON.stringify(jsonData, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
