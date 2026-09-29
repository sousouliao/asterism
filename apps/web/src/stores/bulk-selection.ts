import { create } from 'zustand';

interface BulkSelectionState {
  active: boolean;
  setActive: (active: boolean) => void;
}

/** 跨页面与布局共享的批量选择激活状态，用于协同底部浮层（如选择状态下自动隐藏 AskDock）。 */
export const useBulkSelectionStore = create<BulkSelectionState>((set) => ({
  active: false,
  setActive: (active) => set({ active }),
}));
