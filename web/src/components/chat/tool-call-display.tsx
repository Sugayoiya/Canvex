"use client";

import { useState } from "react";
import { Loader2, Check, X, ChevronDown, ChevronRight, Copy, CheckCheck } from "lucide-react";
import type { AgentMessage } from "@/stores/chat-store";

interface ToolCallDisplayProps {
  message: AgentMessage;
}

function extractOutputText(data?: Record<string, unknown>): string {
  if (!data) return "";
  for (const key of ["text", "result", "content", "output"]) {
    if (typeof data[key] === "string" && data[key]) return data[key] as string;
  }
  return "";
}

export function ToolCallDisplay({ message }: ToolCallDisplayProps) {
  const [argsExpanded, setArgsExpanded] = useState(false);
  const [outputExpanded, setOutputExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const toolCall = message.toolCalls?.[0];
  const toolResult = message.toolResults?.[0];

  const isInProgress = message.role === "tool-call" && !toolResult;
  const isSuccess = toolResult?.success === true;

  const toolName = toolCall?.tool ?? toolResult?.tool ?? "unknown";
  const displayName = toolName.replace(/_/g, " ");
  const outputText = extractOutputText(toolResult?.data);

  const StatusIcon = isInProgress
    ? () => <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500 dark:text-blue-400" />
    : isSuccess
      ? () => <Check className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
      : () => <X className="h-3.5 w-3.5 text-red-500 dark:text-red-400" />;

  const handleCopy = async () => {
    if (!outputText) return;
    await navigator.clipboard.writeText(outputText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="ml-4 space-y-2 rounded-r-md border-l-2 border-blue-500/30 bg-gray-50/50 px-3 py-2 dark:border-blue-400/30 dark:bg-zinc-900/50">
      <button
        onClick={() => setArgsExpanded((v) => !v)}
        className="flex w-full items-center gap-2 text-left"
        aria-expanded={argsExpanded}
      >
        <StatusIcon />
        <span className="text-xs font-semibold text-gray-700 dark:text-zinc-300">
          {displayName}
        </span>
        {toolResult && (
          <span className="text-[10px] text-gray-400 dark:text-zinc-500">
            {toolResult.summary}
          </span>
        )}
        <ChevronRight
          className={`ml-auto h-3 w-3 text-gray-400 transition-transform dark:text-zinc-500 ${argsExpanded ? "rotate-90" : ""}`}
        />
      </button>

      {argsExpanded && toolCall?.args && (
        <pre className="overflow-x-auto rounded bg-gray-100 p-2 font-mono text-xs text-gray-600 dark:bg-zinc-800 dark:text-zinc-400">
          {JSON.stringify(toolCall.args, null, 2).slice(0, 500)}
        </pre>
      )}

      {isSuccess && outputText && (
        <div className="space-y-1">
          <button
            onClick={() => setOutputExpanded((v) => !v)}
            className="flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-400"
          >
            {outputExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            {outputExpanded ? "收起输出" : "展开输出"}
          </button>
          {outputExpanded && (
            <div className="relative">
              <div className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-md bg-white p-3 text-sm leading-relaxed text-gray-800 dark:bg-zinc-800 dark:text-zinc-200">
                {outputText}
              </div>
              <button
                onClick={handleCopy}
                className="absolute right-2 top-2 rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                title="复制"
              >
                {copied ? (
                  <CheckCheck className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {toolResult && !toolResult.success && (
        <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-600 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-400">
          {toolResult.summary}
        </div>
      )}
    </div>
  );
}
