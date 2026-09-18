import { useSyncExternalStore } from 'react';

/**
 * 沉睡唤醒的用户显式反馈（GitHub #40）：
 * Useful / Dismiss 只影响当前用户本地可见性，不写 canonical，也不做遥测。
 * 同一仓库反馈后进入压制期（90 天），之后允许再次自然出现。
 */

export type ResurfaceFeedbackAction = 'useful' | 'dismissed';

export interface ResurfaceFeedbackEntry {
  action: ResurfaceFeedbackAction;
  /** epoch ms */
  at: number;
}

export interface ResurfaceFeedbackStore {
  version: 1;
  entries: Record<string, ResurfaceFeedbackEntry>;
}

/** 反馈压制时长：90 天内不再提醒同一仓库。 */
export const RESURFACE_SUPPRESSION_MS = 90 * 24 * 60 * 60 * 1000;

const EMPTY_STORE: ResurfaceFeedbackStore = { version: 1, entries: {} };
const EMPTY_SUPPRESSED = new Set<string>();

const storeCache = new Map<string, ResurfaceFeedbackStore>();
const suppressedCache = new Map<string, Set<string>>();
const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resurfaceFeedbackStorageKey(userId: string) {
  return `asterism:resurface-feedback:v1:${userId}`;
}

function isValidEntry(value: unknown): value is ResurfaceFeedbackEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const entry = value as Partial<ResurfaceFeedbackEntry>;
  return (
    (entry.action === 'useful' || entry.action === 'dismissed') &&
    typeof entry.at === 'number' &&
    Number.isFinite(entry.at)
  );
}

function isValidStore(value: unknown): value is ResurfaceFeedbackStore {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const store = value as Partial<ResurfaceFeedbackStore>;
  if (store.version !== 1 || !store.entries || typeof store.entries !== 'object') {
    return false;
  }
  return Object.values(store.entries).every(isValidEntry);
}

export function readResurfaceFeedback(userId: string): ResurfaceFeedbackStore {
  const cached = storeCache.get(userId);
  if (cached) {
    return cached;
  }

  let store = EMPTY_STORE;
  try {
    const raw = localStorage.getItem(resurfaceFeedbackStorageKey(userId));
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isValidStore(parsed)) {
        store = parsed;
      }
    }
  } catch {
    // 受限存储下降级为会话内状态：反馈仍即时生效，只是不跨会话保留。
  }
  storeCache.set(userId, store);
  return store;
}

function writeResurfaceFeedback(userId: string, store: ResurfaceFeedbackStore) {
  storeCache.set(userId, store);
  suppressedCache.delete(userId);
  try {
    localStorage.setItem(resurfaceFeedbackStorageKey(userId), JSON.stringify(store));
  } catch {
    // 缓存已更新，当前会话仍能反映用户意图。
  }
}

export function recordResurfaceFeedback(
  userId: string,
  repoId: string,
  action: ResurfaceFeedbackAction,
  now: number = Date.now(),
) {
  const current = readResurfaceFeedback(userId);
  const cutoff = now - RESURFACE_SUPPRESSION_MS;
  const entries: Record<string, ResurfaceFeedbackEntry> = {};
  for (const [id, entry] of Object.entries(current.entries)) {
    if (entry.at > cutoff && id !== repoId) {
      entries[id] = entry;
    }
  }
  entries[repoId] = { action, at: now };
  writeResurfaceFeedback(userId, { version: 1, entries });
  emitChange();
}

/**
 * 当前仍在压制期内的 repoId 集合。
 * 不传 `now` 时返回按用户缓存的稳定快照（供 useSyncExternalStore 复用同一引用）；
 * 显式传入 `now` 时实时计算，不污染缓存。
 */
export function resurfaceSuppressedRepoIds(userId: string, now?: number): Set<string> {
  if (now === undefined) {
    const cached = suppressedCache.get(userId);
    if (cached) {
      return cached;
    }
  }
  const cutoff = (now ?? Date.now()) - RESURFACE_SUPPRESSION_MS;
  const suppressed = new Set<string>();
  for (const [repoId, entry] of Object.entries(readResurfaceFeedback(userId).entries)) {
    if (entry.at > cutoff) {
      suppressed.add(repoId);
    }
  }
  if (now === undefined) {
    suppressedCache.set(userId, suppressed);
  }
  return suppressed;
}

export function useResurfaceSuppressedRepoIds(userId: string | undefined): Set<string> {
  return useSyncExternalStore(
    subscribe,
    () => (userId ? resurfaceSuppressedRepoIds(userId) : EMPTY_SUPPRESSED),
    () => EMPTY_SUPPRESSED,
  );
}

export function resetResurfaceFeedbackState() {
  storeCache.clear();
  suppressedCache.clear();
  emitChange();
}
