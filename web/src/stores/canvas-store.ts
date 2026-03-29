import { create } from "zustand";

interface CanvasAppState {
  canvasId: string | null;
  projectId: string | null;
  isSaving: boolean;
  lastSaved: Date | null;
  focusedNodeId: string | null;
  focusedNodeType: string | null;
  focusedNodeHasContent: boolean;
  setCanvas: (canvasId: string, projectId: string) => void;
  setSaving: (saving: boolean) => void;
  setFocusedNode: (nodeId: string | null, nodeType?: string | null, hasContent?: boolean) => void;
  clearFocus: () => void;
  reset: () => void;
}

export const useCanvasStore = create<CanvasAppState>((set) => ({
  canvasId: null,
  projectId: null,
  isSaving: false,
  lastSaved: null,
  focusedNodeId: null,
  focusedNodeType: null,
  focusedNodeHasContent: false,
  setCanvas: (canvasId, projectId) => set({ canvasId, projectId }),
  setSaving: (saving) =>
    set({ isSaving: saving, ...(saving ? {} : { lastSaved: new Date() }) }),
  setFocusedNode: (nodeId, nodeType = null, hasContent = false) =>
    set({ focusedNodeId: nodeId, focusedNodeType: nodeType, focusedNodeHasContent: hasContent }),
  clearFocus: () =>
    set({ focusedNodeId: null, focusedNodeType: null, focusedNodeHasContent: false }),
  reset: () =>
    set({
      canvasId: null, projectId: null, isSaving: false, lastSaved: null,
      focusedNodeId: null, focusedNodeType: null, focusedNodeHasContent: false,
    }),
}));
