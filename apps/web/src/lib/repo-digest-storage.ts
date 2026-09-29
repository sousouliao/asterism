import type { RepoDigestData } from '@asterism/core';
import { useSyncExternalStore } from 'react';

export interface RepoDigestStore {
  version: 1;
  entries: Record<string, RepoDigestData>;
}

const EMPTY_STORE: RepoDigestStore = { version: 1, entries: {} };
const storeCache = new Map<string, RepoDigestStore>();
const listeners = new Set<() => void>();

export function resetRepoDigestStorageState(): void {
  storeCache.clear();
}

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export function repoDigestStorageKey(userId: string): string {
  return `asterism:repo-digest:v1:${userId}`;
}

function handleStorageEvent(event: StorageEvent) {
  if (event.key !== null && !event.key.startsWith('asterism:repo-digest:v1:')) {
    return;
  }
  storeCache.clear();
  emitChange();
}

function subscribe(listener: () => void) {
  if (listeners.size === 0 && typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorageEvent);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorageEvent);
    }
  };
}

export function readRepoDigestStore(userId: string): RepoDigestStore {
  const cached = storeCache.get(userId);
  if (cached) {
    return cached;
  }

  if (typeof window === 'undefined') {
    return EMPTY_STORE;
  }

  try {
    const raw = window.localStorage.getItem(repoDigestStorageKey(userId));
    if (!raw) {
      storeCache.set(userId, EMPTY_STORE);
      return EMPTY_STORE;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      'version' in parsed &&
      (parsed as RepoDigestStore).version === 1 &&
      'entries' in parsed &&
      typeof (parsed as RepoDigestStore).entries === 'object'
    ) {
      const validStore = parsed as RepoDigestStore;
      storeCache.set(userId, validStore);
      return validStore;
    }
  } catch {
    // 降级回空状态
  }

  storeCache.set(userId, EMPTY_STORE);
  return EMPTY_STORE;
}

export function readRepoDigest(userId: string, repoId: string): RepoDigestData | null {
  const store = readRepoDigestStore(userId);
  return store.entries[repoId] ?? null;
}

export function saveRepoDigest(userId: string, repoId: string, digest: RepoDigestData): void {
  const store = readRepoDigestStore(userId);
  const updated: RepoDigestStore = {
    version: 1,
    entries: {
      ...store.entries,
      [repoId]: digest,
    },
  };

  storeCache.set(userId, updated);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(repoDigestStorageKey(userId), JSON.stringify(updated));
    } catch {
      // 捕获 localStorage 配额超限
    }
  }
  emitChange();
}

export function clearRepoDigest(userId: string, repoId: string): void {
  const store = readRepoDigestStore(userId);
  if (!store.entries[repoId]) return;

  const nextEntries = { ...store.entries };
  delete nextEntries[repoId];

  const updated: RepoDigestStore = {
    version: 1,
    entries: nextEntries,
  };

  storeCache.set(userId, updated);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(repoDigestStorageKey(userId), JSON.stringify(updated));
    } catch {
      // ignore
    }
  }
  emitChange();
}

/**
 * 响应式读取指定仓库的本地提炼速读。
 */
export function useRepoDigest(
  userId: string | undefined,
  repoId: string | undefined,
): RepoDigestData | null {
  return useSyncExternalStore(
    subscribe,
    () => (userId && repoId ? readRepoDigest(userId, repoId) : null),
    () => null,
  );
}
