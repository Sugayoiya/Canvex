"use client";
import { useCallback, useSyncExternalStore } from "react";
import { useReactFlow } from "@xyflow/react";
import {
  Pilcrow,
  List,
  ListOrdered,
  Minus,
  Copy,
  Maximize2,
} from "lucide-react";
import { getEditor, subscribe, getSnapshot } from "../nodes/shared/editor-registry";

interface TextToolbarProps {
  nodeId: string;
}

export function TextToolbar({ nodeId }: TextToolbarProps) {
  const { getNodes } = useReactFlow();

  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const editor = getEditor(nodeId);

  const run = useCallback(
    (cmd: () => void) => { cmd(); },
    [],
  );

  const getNodeText = useCallback(() => {
    const node = getNodes().find((n) => n.id === nodeId);
    if (!node) return "";
    const d = node.data as Record<string, unknown>;
    return (d.result_text as string) || (d.text as string) || "";
  }, [nodeId, getNodes]);

  const handleCopy = useCallback(async () => {
    const text = getNodeText();
    if (text) await navigator.clipboard.writeText(text);
  }, [getNodeText]);

  const isActive = (check: string, attrs?: Record<string, unknown>) =>
    editor?.isActive(check, attrs) ?? false;

  type BtnSpec =
    | { kind: "text"; label: string; active: boolean; action: () => void }
    | { kind: "icon"; icon: React.ComponentType<{ size: number; style?: React.CSSProperties }>; title: string; active?: boolean; action: () => void }
    | { kind: "sep" };

  const buttons: BtnSpec[] = [
    {
      kind: "text", label: "H1",
      active: isActive("heading", { level: 1 }),
      action: () => run(() => editor?.chain().focus().toggleHeading({ level: 1 }).run()),
    },
    {
      kind: "text", label: "H2",
      active: isActive("heading", { level: 2 }),
      action: () => run(() => editor?.chain().focus().toggleHeading({ level: 2 }).run()),
    },
    {
      kind: "text", label: "H3",
      active: isActive("heading", { level: 3 }),
      action: () => run(() => editor?.chain().focus().toggleHeading({ level: 3 }).run()),
    },
    {
      kind: "icon", icon: Pilcrow, title: "正文",
      active: isActive("paragraph") && !isActive("heading"),
      action: () => run(() => editor?.chain().focus().setParagraph().run()),
    },
    {
      kind: "text", label: "B",
      active: isActive("bold"),
      action: () => run(() => editor?.chain().focus().toggleBold().run()),
    },
    {
      kind: "text", label: "I",
      active: isActive("italic"),
      action: () => run(() => editor?.chain().focus().toggleItalic().run()),
    },
    { kind: "sep" },
    {
      kind: "icon", icon: List, title: "无序列表",
      active: isActive("bulletList"),
      action: () => run(() => editor?.chain().focus().toggleBulletList().run()),
    },
    {
      kind: "icon", icon: ListOrdered, title: "有序列表",
      active: isActive("orderedList"),
      action: () => run(() => editor?.chain().focus().toggleOrderedList().run()),
    },
    { kind: "sep" },
    {
      kind: "icon", icon: Minus, title: "分割线",
      action: () => run(() => editor?.chain().focus().setHorizontalRule().run()),
    },
    { kind: "icon", icon: Copy, title: "复制", action: handleCopy },
    { kind: "icon", icon: Maximize2, title: "展开" , action: () => { /* TODO: expand modal */ } },
  ];

  return (
    <div
      className="flex items-center gap-1"
      role="toolbar"
      style={{
        height: 36,
        padding: "4px 8px",
        background: "var(--cv4-surface-primary)",
        borderRadius: "var(--cv4-radius-toolbar)",
        border: "1px solid var(--cv4-border-default)",
        boxShadow: "var(--cv4-shadow-sm)",
      }}
    >
      {buttons.map((btn, i) => {
        if (btn.kind === "sep") {
          return (
            <div
              key={`sep-${i}`}
              style={{
                width: 1,
                height: 16,
                background: "var(--cv4-border-divider)",
                flexShrink: 0,
              }}
            />
          );
        }

        const active = "active" in btn && btn.active;

        if (btn.kind === "text") {
          return (
            <button
              key={btn.label}
              onClick={btn.action}
              className="flex items-center justify-center cursor-pointer shrink-0"
              title={btn.label}
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: active ? "var(--cv4-active-highlight)" : "transparent",
                fontFamily: "Space Grotesk, sans-serif",
                fontSize: 13,
                fontWeight: btn.label === "B" ? 700 : btn.label === "I" ? 400 : 600,
                fontStyle: btn.label === "I" ? "italic" : "normal",
                color: active ? "var(--cv4-text-primary)" : "var(--cv4-text-secondary)",
                transition: "background 100ms",
                border: "none",
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = "var(--cv4-hover-highlight)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = active ? "var(--cv4-active-highlight)" : "transparent";
              }}
            >
              {btn.label}
            </button>
          );
        }

        const Icon = btn.icon;
        return (
          <button
            key={btn.title}
            onClick={btn.action}
            className="flex items-center justify-center cursor-pointer shrink-0"
            title={btn.title}
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: active ? "var(--cv4-active-highlight)" : "transparent",
              transition: "background 100ms",
              border: "none",
            }}
            onMouseEnter={(e) => {
              if (!active) e.currentTarget.style.background = "var(--cv4-hover-highlight)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = active ? "var(--cv4-active-highlight)" : "transparent";
            }}
          >
            <Icon
              size={14}
              style={{ color: active ? "var(--cv4-text-primary)" : "var(--cv4-text-secondary)" }}
            />
          </button>
        );
      })}
    </div>
  );
}
