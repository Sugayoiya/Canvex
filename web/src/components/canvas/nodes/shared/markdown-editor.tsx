"use client";

import { useEffect, useRef } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import { bump } from "./editor-registry";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getMarkdownFromEditor(e: Editor): string {
  return (e.storage as any).markdown.getMarkdown();
}

interface MarkdownEditorProps {
  content: string;
  editable: boolean;
  placeholder?: string;
  onChange?: (markdown: string) => void;
  onEditorReady?: (editor: Editor) => void;
}

export function MarkdownEditor({
  content,
  editable,
  placeholder = "输入文本内容…",
  onChange,
  onEditorReady,
}: MarkdownEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onEditorReadyRef = useRef(onEditorReady);
  onEditorReadyRef.current = onEditorReady;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({ placeholder }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content,
    editable,
    editorProps: {
      attributes: {
        class: "cv4-md-editor nodrag nowheel nopan outline-none",
      },
    },
    onUpdate: ({ editor: e }) => {
      onChangeRef.current?.(getMarkdownFromEditor(e));
      bump();
    },
    onSelectionUpdate: () => bump(),
    immediatelyRender: false,
  });

  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
      if (editable) {
        editor.commands.focus("end");
      }
    }
  }, [editor, editable]);

  useEffect(() => {
    if (editor) onEditorReadyRef.current?.(editor);
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const currentMd = getMarkdownFromEditor(editor);
    if (content !== currentMd) {
      editor.commands.setContent(content);
    }
  }, [editor, content]);

  return <EditorContent editor={editor} />;
}

export type { Editor };
