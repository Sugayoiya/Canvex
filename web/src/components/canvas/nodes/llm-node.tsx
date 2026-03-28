"use client";

import { useCallback, useState } from "react";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import {
  Sparkles,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { useNodeExecution } from "../hooks/use-node-execution";
import { useUpstreamData } from "../hooks/use-upstream-data";
import { useNodePersistence } from "../hooks/use-node-persistence";

type ModelProvider = "auto" | "gemini" | "openai" | "deepseek";

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
  const config = (nodeData.config as Record<string, unknown>) ?? {};
  const { setNodes } = useReactFlow();
  const upstream = useUpstreamData(id);
  const persistence = useNodePersistence(id);
  const [expanded, setExpanded] = useState(false);

  const handleExecutionComplete = useCallback((resultData: any) => {
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
  }, [id, setNodes, persistence]);

  const execution = useNodeExecution(id, handleExecutionComplete);

  const provider = (config.provider as ModelProvider) ?? "auto";
  const style = STATUS_STYLES[execution.status] ?? STATUS_STYLES.idle;

  const updateProvider = useCallback(
    (value: string) => {
      const newConfig = { ...(config as Record<string, unknown>), provider: value };
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id
            ? { ...n, data: { ...n.data, config: newConfig } }
            : n,
        ),
      );
      persistence.saveDebounced({ config: newConfig });
    },
    [id, setNodes, config, persistence],
  );

  const handleExecute = useCallback(() => {
    const inputText = upstream.text.join("\n") || (nodeData.text as string) || "";
    persistence.cancelPending();
    execution.execute("text.llm_generate", {
      provider,
      ...(inputText ? { text: inputText } : {}),
    });
    persistence.saveImmediate({ config, status: "queued" });
  }, [execution, provider, upstream.text, nodeData.text, config, persistence]);

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
        <div>
          <label className="mb-1 block text-[10px] text-zinc-500">
            模型提供商
          </label>
          <select
            value={provider}
            onChange={(e) => updateProvider(e.target.value)}
            className="w-full rounded-md border border-zinc-600 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 focus:border-blue-500/50 focus:outline-none"
          >
            <option value="auto">自动选择</option>
            <option value="gemini">Gemini</option>
            <option value="openai">OpenAI</option>
            <option value="deepseek">DeepSeek</option>
          </select>
        </div>

        <button
          onClick={handleExecute}
          disabled={
            execution.status === "running" || execution.status === "queued"
          }
          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {execution.status === "running" || execution.status === "queued" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Play className="h-3 w-3" />
          )}
          执行
        </button>

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
