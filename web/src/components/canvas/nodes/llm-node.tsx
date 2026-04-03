"use client";

import { useState } from "react";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { useNodeExecution } from "../hooks/use-node-execution";
import { useNodePersistence } from "../hooks/use-node-persistence";

const STATUS_STYLES: Record<
  string,
  { border: string; icon: React.ReactNode; label: string }
> = {
  idle: {
    border: "border-zinc-700",
    icon: <Sparkles className="h-3.5 w-3.5 text-violet-400" />,
    label: "",
  },
  queued: {
    border: "border-yellow-600/60",
    icon: <Clock className="h-3.5 w-3.5 animate-pulse text-yellow-400" />,
    label: "排队中",
  },
  running: {
    border: "border-blue-500/60",
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />,
    label: "执行中",
  },
  completed: {
    border: "border-green-600/60",
    icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />,
    label: "完成",
  },
  failed: {
    border: "border-red-600/60",
    icon: <XCircle className="h-3.5 w-3.5 text-red-400" />,
    label: "失败",
  },
  timeout: {
    border: "border-orange-600/60",
    icon: <Clock className="h-3.5 w-3.5 text-orange-400" />,
    label: "超时",
  },
};

export function LLMNode({ id, data }: NodeProps) {
  const nodeData = data as Record<string, unknown>;
  const { setNodes } = useReactFlow();
  const persistence = useNodePersistence(id);
  const [expanded, setExpanded] = useState(false);

  const handleExecutionComplete = (resultData: any) => {
    persistence.cancelPending();
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id
          ? {
              ...n,
              data: {
                ...n.data,
                result_text: typeof resultData === "string" ? resultData : (resultData?.text ?? resultData?.result ?? null),
                result_url: resultData?.url ?? resultData?.result_url ?? null,
                result_data: typeof resultData === "object" ? resultData : null,
              },
            }
          : n,
      ),
    );
  };

  const execution = useNodeExecution(id, handleExecutionComplete);
  const style = STATUS_STYLES[execution.status] ?? STATUS_STYLES.idle;

  const resultText =
    typeof execution.data === "string"
      ? execution.data
      : execution.data?.text ?? execution.data?.result ?? "";
  const displayText = expanded
    ? String(resultText)
    : String(resultText).slice(0, 200);

  return (
    <div
      className={`min-w-[240px] rounded-lg border bg-zinc-800 shadow-md ${style.border}`}
    >
      <div className="flex items-center justify-between border-b border-zinc-700 px-3 py-2">
        <div className="flex items-center gap-2">
          {style.icon}
          <span className="text-xs font-medium text-zinc-200">LLM 生成</span>
          {style.label && (
            <span className="text-[10px] text-zinc-400">{style.label}</span>
          )}
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="!h-3 !w-3 !border-2 !border-zinc-600 !bg-cyan-500"
      />

      <div className="space-y-3 p-3">
        {execution.status === "completed" && resultText && (
          <div className="space-y-1">
            <div className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md bg-zinc-900 p-2 text-xs text-zinc-300">
              {displayText}
              {!expanded && String(resultText).length > 200 && "..."}
            </div>
            {String(resultText).length > 200 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-[10px] text-blue-400 hover:text-blue-300"
              >
                {expanded ? "收起" : "展开"}
              </button>
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
