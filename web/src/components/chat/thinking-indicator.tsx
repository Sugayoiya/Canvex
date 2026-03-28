"use client";

interface ThinkingIndicatorProps {
  text?: string;
}

export function ThinkingIndicator({
  text = "正在思考...",
}: ThinkingIndicatorProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <div className="flex items-center gap-1">
        <span
          className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse motion-reduce:animate-none motion-reduce:opacity-70 dark:bg-amber-400"
        />
        <span
          className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse motion-reduce:animate-none motion-reduce:opacity-70 dark:bg-amber-400"
          style={{ animationDelay: "150ms" }}
        />
        <span
          className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse motion-reduce:animate-none motion-reduce:opacity-70 dark:bg-amber-400"
          style={{ animationDelay: "300ms" }}
        />
      </div>
      <span className="text-xs text-gray-400 dark:text-zinc-500">{text}</span>
    </div>
  );
}
