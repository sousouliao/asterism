import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

export type RepoViewMode = 'grid' | 'list';

interface BrowseViewState {
  view: RepoViewMode;
  setView: (view: RepoViewMode) => void;
}

function isRepoViewMode(value: unknown): value is RepoViewMode {
  return value === 'grid' || value === 'list';
}

export function migrateBrowseViewState(persistedState: unknown): { view: RepoViewMode } {
  if (
    typeof persistedState === 'object' &&
    persistedState !== null &&
    'view' in persistedState &&
    isRepoViewMode(persistedState.view)
  ) {
    return { view: persistedState.view };
  }
  return { view: 'grid' };
}

const fallbackStorageData = new Map<string, string>();
const fallbackStorage: StateStorage = {
  getItem: (key) => fallbackStorageData.get(key) ?? null,
  removeItem: (key) => fallbackStorageData.delete(key),
  setItem: (key, value) => fallbackStorageData.set(key, value),
};

function resolveBrowseViewStorage(): StateStorage {
  try {
    const storage = globalThis.localStorage;
    const probeKey = '__asterism_browse_view_storage_probe__';
    storage.setItem(probeKey, probeKey);
    const usable = storage.getItem(probeKey) === probeKey;
    storage.removeItem(probeKey);
    return usable ? storage : fallbackStorage;
  } catch {
    return fallbackStorage;
  }
}

const browseViewStorage = resolveBrowseViewStorage();

/** Browse 视图模式偏好，持久化到 localStorage 以跨会话保留。 */
export const useBrowseViewStore = create<BrowseViewState>()(
  persist(
    (set) => ({
      view: 'grid',
      setView: (view) => set({ view }),
    }),
    {
      name: 'asterism-browse-view',
      version: 1,
      storage: createJSONStorage(() => browseViewStorage),
      partialize: (state) => ({ view: state.view }),
      migrate: migrateBrowseViewState,
    },
  ),
);

/** 读取持久化视图（初始化用，非热路径订阅）。 */
export function getBrowseView(): RepoViewMode {
  const view = useBrowseViewStore.getState().view;
  return isRepoViewMode(view) ? view : 'grid';
}

/** 写入持久化视图（useEffect 异步路径，非点击热路径）。 */
export function setBrowseViewPersisted(view: RepoViewMode): void {
  useBrowseViewStore.getState().setView(isRepoViewMode(view) ? view : 'grid');
}
