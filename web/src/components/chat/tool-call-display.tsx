"use client";

import { useState } from "react";
import { Loader2, Check, X, ChevronRight } from "lucide-react";
import type { AgentMessage } from "@/stores/chat-store";

interface ToolCallDisplayProps {
  message: AgentMessage;
}

export function ToolCallDisplay({ message }: ToolCallDisplayProps) {
  const [expanded, setExpanded] = useState(false);

  const toolCall = message.toolCalls?.[0];
  const toolResult = message.toolResults?.[0];

  const isInProgress = message.role === "tool-call" && !toolResult;
  const isSuccess = toolResult?.success === true;
  const isFailed = toolResult?.success === false;

  const toolName = toolCall?.tool ?? toolResult?.tool ?? "unknown";
  const displayName = toolName.replace(/_/g, " ");

  const StatusIcon = isInProgress
    ? () => <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500 dark:text-blue-400" />
    : isSuccess
      ? () => <Check className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
      : () => <X className="h-3.5 w-3.5 text-red-500 dark:text-red-400" />;

  return (
    <div className="ml-4 rounded-r-md border-l-2 border-blue-500/30 bg-gray-50/50 px-3 py-2 dark:border-blue-400/30 dark:bg-zinc-900/50">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 text-left"
        aria-expanded={expanded}
      >
        <StatusIcon />
        <span className="text-xs font-semibold text-gray-700 dark:text-zinc-300">
          {displayName}
        </span>
        <ChevronRight
          className={`ml-auto h-3 w-3 text-gray-400 transition-transform dark:text-zinc-500 ${expanded ? "rotate-90" : ""}`}
        />
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          {toolCall?.args && (
            <pre className="overflow-x-auto rounded bg-gray-100 p-2 font-mono text-xs text-gray-600 dark:bg-zinc-800 dark:text-zinc-400">
              {JSON.stringify(toolCall.args, null, 2).slice(0, 500)}
            </pre>
          )}
          {toolResult && (
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              {toolResult.success ? "✅" : "❌"} {toolResult.summary}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
