"use client";

const NODE_TYPE_LABELS: { type: string; label: string }[] = [
  { type: "text-input", label: "文本输入" },
  { type: "llm-generate", label: "LLM 生成" },
  { type: "extract", label: "提取" },
  { type: "image-gen", label: "图片生成" },
  { type: "output", label: "输出" },
];

interface CanvasToolbarProps {
  onAddNode: (nodeType: string) => void;
}

export function CanvasToolbar({ onAddNode }: CanvasToolbarProps) {
  return (
    <div className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-white/90 px-3 py-2 shadow-md backdrop-blur dark:bg-zinc-900/90 dark:shadow-zinc-800/40">
      {NODE_TYPE_LABELS.map(({ type, label }) => (
        <button
          key={type}
          onClick={() => onAddNode(type)}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-zinc-800"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default CanvasToolbar;
