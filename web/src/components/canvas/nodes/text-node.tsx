"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import type { NodeProps } from "@xyflow/react";
import { useReactFlow } from "@xyflow/react";
import { FileText } from "lucide-react";
import { NodeShell } from "./shared/node-shell";
import { useNodeFocus } from "../hooks/use-node-focus";
import { useNodePersistence } from "../hooks/use-node-persistence";

export function TextNode({ id, data }: NodeProps) {
  const d = data as Record<string, unknown>;
  const text = (d.result_text as string) || (d.text as string) || "";
  const hasContent = text.length > 0;
  const status = (d.status as string) || "idle";
  const { focusedNodeId, handleNodeClick } = useNodeFocus();
  const { saveDebounced } = useNodePersistence(id);
  const { setNodes } = useReactFlow();
  const isFocused = focusedNodeId === id;
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isFocused) setIsEditing(false);
  }, [isFocused]);

  useEffect(() => {
    setEditText(text);
  }, [text]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditText(text);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [text]);

  const handleTextChange = useCallback(
    (value: string) => {
      setEditText(value);
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, text: value, result_text: value } } : n,
        ),
      );
      saveDebounced({ config: { text: value }, result_text: value });
    },
    [id, setNodes, saveDebounced],
  );

  return (
    <div onClick={() => handleNodeClick(id, "text", hasContent || isEditing)}>
      <NodeShell
        nodeId={id}
        nodeType="text"
        hasContent={hasContent || isEditing}
        status={status as "idle" | "queued" | "running" | "completed" | "failed" | "timeout" | "blocked"}
        isFocused={isFocused}
      >
        {isEditing ? (
          <div style={{ padding: "8px 12px" }} onDoubleClick={(e) => e.stopPropagation()}>
            <textarea
              ref={textareaRef}
              value={editText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="输入文本内容..."
              rows={5}
              className="nodrag nowheel nopan"
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                outline: "none",
                resize: "vertical",
                fontFamily: "Manrope, sans-serif",
                fontSize: 13,
                color: "var(--cv4-text-primary)",
                lineHeight: 1.6,
                minHeight: 80,
              }}
            />
          </div>
        ) : hasContent ? (
          <div style={{ padding: "12px 16px", cursor: "text" }} onDoubleClick={handleDoubleClick}>
            <div className="flex gap-3">
              <div
                style={{
                  width: 3,
                  background: "var(--cv4-text-disabled)",
                  borderRadius: 2,
                  opacity: 0.6,
                  flexShrink: 0,
                }}
              />
              <div className="min-w-0 flex-1">
                <p
                  style={{
                    fontFamily: "Manrope, sans-serif",
                    fontSize: 15,
                    fontWeight: 700,
                    lineHeight: 1.6,
                    color: "var(--cv4-text-primary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {text.split("\n")[0]}
                </p>
                {text.split("\n").length > 1 && (
                  <p
                    style={{
                      fontFamily: "Manrope, sans-serif",
                      fontSize: 12,
                      lineHeight: 1.6,
                      color: "var(--cv4-text-muted)",
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {text.split("\n").slice(1).join("\n")}
                  </p>
                )}
              </div>
            </div>
            <span
              style={{
                fontFamily: "Manrope, sans-serif",
                fontSize: 10,
                color: "var(--cv4-text-disabled)",
                marginTop: 4,
                display: "block",
              }}
            >
              双击编辑
            </span>
          </div>
        ) : (
          <div
            className="flex flex-col items-center justify-center cursor-text"
            style={{ height: 100, background: "var(--cv4-surface-secondary)" }}
            onDoubleClick={handleDoubleClick}
          >
            <FileText size={28} style={{ color: "var(--cv4-text-disabled)" }} />
            <span
              style={{
                fontFamily: "Manrope, sans-serif",
                fontSize: 11,
                color: "var(--cv4-text-disabled)",
                marginTop: 8,
              }}
            >
              双击输入文本 · 或用下方 AI 生成
            </span>
          </div>
        )}
      </NodeShell>
    </div>
  );
}
