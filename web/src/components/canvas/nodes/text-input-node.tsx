"use client";

import { useCallback } from "react";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { PencilLine } from "lucide-react";
import { useNodePersistence } from "../hooks/use-node-persistence";

export function TextInputNode({ id, data }: NodeProps) {
  const nodeData = data as Record<string, unknown>;
  const text = (nodeData.text as string) ?? "";
  const { setNodes } = useReactFlow();
  const persistence = useNodePersistence(id);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, text: value } } : n,
        ),
      );
      persistence.saveDebounced({ config: { text: value } });
    },
    [id, setNodes, persistence],
  );

  const handleBlur = useCallback(() => {
    persistence.flush();
  }, [persistence]);

  return (
    <div className="min-w-[220px] rounded-lg border border-zinc-700 bg-zinc-800 shadow-md">
      <div className="flex items-center gap-2 border-b border-zinc-700 px-3 py-2">
        <PencilLine className="h-3.5 w-3.5 text-cyan-400" />
        <span className="text-xs font-medium text-zinc-200">文本输入</span>
      </div>
      <div className="p-3">
        <textarea
          value={text}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="输入文本内容..."
          rows={4}
          className="w-full resize-none rounded-md border border-zinc-600 bg-zinc-900 px-2.5 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:border-cyan-500/50 focus:outline-none"
        />
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
