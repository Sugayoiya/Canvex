"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import type { NodeProps } from "@xyflow/react";
import { useReactFlow } from "@xyflow/react";
import { FileText } from "lucide-react";
import { NodeShell } from "./shared/node-shell";
import { MarkdownEditor, type Editor } from "./shared/markdown-editor";
import { registerEditor, unregisterEditor } from "./shared/editor-registry";
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
  const editorRef = useRef<Editor | null>(null);

  useEffect(() => {
    if (!isFocused) setIsEditing(false);
  }, [isFocused]);

  useEffect(() => {
    return () => unregisterEditor(id);
  }, [id]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    handleNodeClick(id, "text", true);
  }, [id, handleNodeClick]);

  const handleChange = useCallback(
    (markdown: string) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, text: markdown, result_text: markdown } } : n,
        ),
      );
      saveDebounced({ config: { text: markdown }, result_text: markdown });
    },
    [id, setNodes, saveDebounced],
  );

  const handleEditorReady = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      registerEditor(id, editor);
    },
    [id],
  );

  const editable = isEditing || (isFocused && hasContent);
  const showEditor = hasContent || isEditing;

  return (
    <div onClick={() => handleNodeClick(id, "text", hasContent || isEditing)}>
      <NodeShell
        nodeId={id}
        nodeType="text"
        hasContent={hasContent || isEditing}
        status={status as "idle" | "queued" | "running" | "completed" | "failed" | "timeout" | "blocked"}
        isFocused={isFocused}
      >
        {showEditor ? (
          <div
            className={editable ? "" : "cv4-md-editor-preview"}
            onDoubleClick={handleDoubleClick}
          >
            <MarkdownEditor
              content={text}
              editable={editable}
              onChange={handleChange}
              onEditorReady={handleEditorReady}
            />
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
