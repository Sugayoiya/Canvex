"use client";

import { useCallback, useState } from "react";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import {
  ImageIcon,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
} from "lucide-react";
import { useNodeExecution } from "../hooks/use-node-execution";

const ASPECT_RATIOS = ["16:9", "1:1", "9:16"] as const;
type AspectRatio = (typeof ASPECT_RATIOS)[number];

const STATUS_STYLES: Record<
  string,
  { border: string; icon: React.ReactNode }
> = {
  idle: {
    border: "border-zinc-700",
    icon: <ImageIcon className="h-3.5 w-3.5 text-amber-400" />,
  },
  queued: {
    border: "border-yellow-600/60",
    icon: <Clock className="h-3.5 w-3.5 animate-pulse text-yellow-400" />,
  },
  running: {
    border: "border-blue-500/60",
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />,
  },
  completed: {
    border: "border-green-600/60",
    icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />,
  },
  failed: {
    border: "border-red-600/60",
    icon: <XCircle className="h-3.5 w-3.5 text-red-400" />,
  },
  timeout: {
    border: "border-orange-600/60",
    icon: <Clock className="h-3.5 w-3.5 text-orange-400" />,
  },
  blocked: {
    border: "border-red-600/60",
    icon: <ShieldAlert className="h-3.5 w-3.5 text-red-400" />,
  },
};

export function ImageGenNode({ id, data }: NodeProps) {
  const nodeData = data as Record<string, unknown>;
  const config = (nodeData.config as Record<string, unknown>) ?? {};
  const { setNodes } = useReactFlow();
  const execution = useNodeExecution(id);
  const [imgError, setImgError] = useState(false);

  const aspectRatio = (config.aspect_ratio as AspectRatio) ?? "16:9";
  const style = STATUS_STYLES[execution.status] ?? STATUS_STYLES.idle;

  const updateAspectRatio = useCallback(
    (value: string) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...n.data,
                  config: {
                    ...(n.data.config as Record<string, unknown>),
                    aspect_ratio: value,
                  },
                },
              }
            : n,
        ),
      );
    },
    [id, setNodes],
  );

  const handleExecute = useCallback(() => {
    execution.execute("visual.generate_image", {
      aspect_ratio: aspectRatio,
      ...(nodeData.text ? { prompt: nodeData.text } : {}),
    });
  }, [execution, aspectRatio, nodeData.text]);

  const resultUrl =
    execution.data?.url ?? execution.data?.result_url ?? null;

  return (
    <div
      className={`min-w-[240px] rounded-lg border bg-zinc-800 shadow-md ${style.border}`}
    >
      <div className="flex items-center gap-2 border-b border-zinc-700 px-3 py-2">
        {style.icon}
        <span className="text-xs font-medium text-zinc-200">图片生成</span>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="!h-3 !w-3 !border-2 !border-zinc-600 !bg-cyan-500"
      />

      <div className="space-y-3 p-3">
        <div>
          <label className="mb-1 block text-[10px] text-zinc-500">
            画面比例
          </label>
          <select
            value={aspectRatio}
            onChange={(e) => updateAspectRatio(e.target.value)}
            className="w-full rounded-md border border-zinc-600 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 focus:border-blue-500/50 focus:outline-none"
          >
            {ASPECT_RATIOS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleExecute}
          disabled={
            execution.status === "running" || execution.status === "queued"
          }
          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {execution.status === "running" || execution.status === "queued" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Play className="h-3 w-3" />
          )}
          生成图片
        </button>

        {execution.status === "completed" && resultUrl && !imgError && (
          <div className="overflow-hidden rounded-md">
            <img
              src={resultUrl}
              alt="生成结果"
              className="w-full object-contain"
              onError={() => setImgError(true)}
            />
          </div>
        )}

        {execution.status === "blocked" && (
          <div className="flex items-center gap-1.5 rounded-md border border-red-800/50 bg-red-950/30 p-2">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-red-400" />
            <span className="text-[10px] text-red-400">
              内容安全策略拦截
            </span>
          </div>
        )}

        {execution.status === "failed" && execution.message && (
          <div className="rounded-md border border-red-800/50 bg-red-950/30 p-2 text-[10px] text-red-400">
            {execution.message}
          </div>
        )}

        {execution.status === "timeout" && (
          <div className="rounded-md border border-orange-800/50 bg-orange-950/30 p-2 text-[10px] text-orange-400">
            {execution.message || "轮询超时，请重试"}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="!h-3 !w-3 !border-2 !border-zinc-600 !bg-cyan-500"
      />
    </div>
  );
}
