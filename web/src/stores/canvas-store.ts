import { create } from "zustand";

interface CanvasAppState {
  canvasId: string | null;
  projectId: string | null;
  isSaving: boolean;
  lastSaved: Date | null;
  setCanvas: (canvasId: string, projectId: string) => void;
  setSaving: (saving: boolean) => void;
  reset: () => void;
}

export const useCanvasStore = create<CanvasAppState>((set) => ({
  canvasId: null,
  projectId: null,
  isSaving: false,
  lastSaved: null,
  setCanvas: (canvasId, projectId) => set({ canvasId, projectId }),
  setSaving: (saving) =>
    set({ isSaving: saving, ...(saving ? {} : { lastSaved: new Date() }) }),
  reset: () =>
    set({ canvasId: null, projectId: null, isSaving: false, lastSaved: null }),
}));
