"use client";

import { useCallback, useState } from "react";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import {
  ListFilter,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { useNodeExecution } from "../hooks/use-node-execution";

type ExtractType = "extract.characters" | "extract.scenes";

const EXTRACT_OPTIONS: { value: ExtractType; label: string }[] = [
  { value: "extract.characters", label: "角色" },
  { value: "extract.scenes", label: "场景" },
];

const STATUS_STYLES: Record<
  string,
  { border: string; icon: React.ReactNode }
> = {
  idle: {
    border: "border-zinc-700",
    icon: <ListFilter className="h-3.5 w-3.5 text-emerald-400" />,
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
};

export function ExtractNode({ id, data }: NodeProps) {
  const nodeData = data as Record<string, unknown>;
  const config = (nodeData.config as Record<string, unknown>) ?? {};
  const { setNodes } = useReactFlow();
  const execution = useNodeExecution(id);
  const [jsonExpanded, setJsonExpanded] = useState(false);

  const extractType =
    (config.extract_type as ExtractType) ?? "extract.characters";
  const style = STATUS_STYLES[execution.status] ?? STATUS_STYLES.idle;

  const updateExtractType = useCallback(
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
                    extract_type: value,
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
    execution.execute(extractType, {
      ...(nodeData.text ? { text: nodeData.text } : {}),
    });
  }, [execution, extractType, nodeData.text]);

  const resultData = execution.data;
  const resultItems = Array.isArray(resultData)
    ? resultData
    : resultData?.items ?? resultData?.results ?? [];
  const itemCount = Array.isArray(resultItems) ? resultItems.length : 0;

  return (
    <div
      className={`min-w-[220px] rounded-lg border bg-zinc-800 shadow-md ${style.border}`}
    >
      <div className="flex items-center gap-2 border-b border-zinc-700 px-3 py-2">
        {style.icon}
        <span className="text-xs font-medium text-zinc-200">提取</span>
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
            提取类型
          </label>
          <select
            value={extractType}
            onChange={(e) => updateExtractType(e.target.value)}
            className="w-full rounded-md border border-zinc-600 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 focus:border-blue-500/50 focus:outline-none"
          >
            {EXTRACT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleExecute}
          disabled={
            execution.status === "running" || execution.status === "queued"
          }
          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {execution.status === "running" || execution.status === "queued" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Play className="h-3 w-3" />
          )}
          提取
        </button>

        {execution.status === "completed" && resultData && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-400">
                提取到 {itemCount} 项
              </span>
              <button
                onClick={() => setJsonExpanded(!jsonExpanded)}
                className="text-[10px] text-blue-400 hover:text-blue-300"
              >
                {jsonExpanded ? "收起 JSON" : "查看 JSON"}
              </button>
            </div>
            {jsonExpanded && (
              <pre className="max-h-48 overflow-auto rounded-md bg-zinc-900 p-2 text-[10px] text-zinc-300">
                {JSON.stringify(resultData, null, 2)}
              </pre>
            )}
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
