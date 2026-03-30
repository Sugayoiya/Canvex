import type { Editor } from "@tiptap/react";

const editors = new Map<string, Editor>();

const listeners = new Set<() => void>();
let tick = 0;

export function registerEditor(nodeId: string, editor: Editor) {
  editors.set(nodeId, editor);
  bump();
}

export function unregisterEditor(nodeId: string) {
  editors.delete(nodeId);
  bump();
}

export function getEditor(nodeId: string): Editor | undefined {
  return editors.get(nodeId);
}

/** Call after any editor state change so subscribers re-render. */
export function bump() {
  tick++;
  listeners.forEach((l) => l());
}

export function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getSnapshot() {
  return tick;
}
