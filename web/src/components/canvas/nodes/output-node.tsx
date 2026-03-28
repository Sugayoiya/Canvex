"use client";

import { useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Monitor } from "lucide-react";
import { useUpstreamData } from "../hooks/use-upstream-data";

export function OutputNode({ id, data }: NodeProps) {
  const nodeData = data as Record<string, unknown>;
  const upstream = useUpstreamData(id);
  const [imgError, setImgError] = useState(false);

  const texts =
    upstream.text.length > 0
      ? upstream.text
      : nodeData.text
        ? [nodeData.text as string]
        : [];
  const images =
    upstream.imageUrl.length > 0
      ? upstream.imageUrl
      : nodeData.imageUrl || nodeData.image_url
        ? [((nodeData.imageUrl ?? nodeData.image_url) as string)]
        : [];
  const jsons: object[] =
    upstream.json.length > 0
      ? upstream.json
      : nodeData.json || nodeData.data
        ? [nodeData.json ?? nodeData.data] as object[]
        : [];

  const hasContent = texts.length > 0 || images.length > 0 || jsons.length > 0;

  return (
    <div className="min-w-[200px] max-w-[320px] rounded-lg border border-zinc-700 bg-zinc-800 shadow-md">
      <div className="flex items-center gap-2 border-b border-zinc-700 px-3 py-2">
        <Monitor className="h-3.5 w-3.5 text-zinc-400" />
        <span className="text-xs font-medium text-zinc-200">输出</span>
        {hasContent && (
          <span className="ml-auto text-[10px] text-zinc-500">
            {texts.length > 0 && `${texts.length} 文本`}
            {images.length > 0 && ` ${images.length} 图片`}
            {jsons.length > 0 && ` ${jsons.length} 数据`}
          </span>
        )}
      </div>

      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="!h-3 !w-3 !border-2 !border-zinc-600 !bg-cyan-500"
      />

      <div className="max-h-[300px] overflow-auto p-3 space-y-2">
        {!hasContent && (
          <div className="flex flex-col items-center justify-center py-6 text-zinc-500">
            <Monitor className="mb-1 h-6 w-6" />
            <span className="text-[10px]">连接上游节点以查看输出</span>
          </div>
        )}

        {images.map(
          (url, i) =>
            !imgError && (
              <div key={`img-${i}`} className="overflow-hidden rounded-md">
                <img
                  src={url}
                  alt={`输出图片 ${i + 1}`}
                  className="w-full object-contain"
                  onError={() => setImgError(true)}
                />
              </div>
            ),
        )}

        {texts.map((t, i) => (
          <div
            key={`txt-${i}`}
            className="whitespace-pre-wrap text-xs text-zinc-300"
          >
            {t}
          </div>
        ))}

        {jsons.map(
          (j, i) =>
            j &&
            typeof j === "object" && (
              <pre
                key={`json-${i}`}
                className="overflow-auto whitespace-pre-wrap rounded-md bg-zinc-900 p-2 text-[10px] text-zinc-300"
              >
                {JSON.stringify(j, null, 2)}
              </pre>
            ),
        )}
      </div>
    </div>
  );
}
