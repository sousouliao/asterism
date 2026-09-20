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

/** 压制集合快照；`validUntil` 是其中最早一条压制到期的时刻。 */
interface SuppressedSnapshot {
  repoIds: Set<string>;
  validUntil: number;
}

const storeCache = new Map<string, ResurfaceFeedbackStore>();
const suppressedCache = new Map<string, SuppressedSnapshot>();
const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

/** 另一标签页写入反馈后，本页缓存必须失效，否则两页的压制集合会长期分叉。 */
function handleStorageEvent(event: StorageEvent) {
  if (event.key !== null && !event.key.startsWith('asterism:resurface-feedback:v1:')) {
    return;
  }
  storeCache.clear();
  suppressedCache.clear();
  emitChange();
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) {
    window.addEventListener('storage', handleStorageEvent);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener('storage', handleStorageEvent);
    }
  };
}

/** 供非 React 调用方订阅反馈变化；订阅期间同时接管跨标签页的 storage 事件。 */
export function subscribeResurfaceFeedback(listener: () => void) {
  return subscribe(listener);
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
 *
 * 不传 `now` 时返回按用户缓存的稳定快照（供 useSyncExternalStore 复用同一引用），
 * 但缓存带到期时间：最早一条压制走完 90 天后自动重算，否则只要用户不再提交反馈，
 * 该集合就永远冻结，被压制的仓库再也不会重新浮现。显式传入 `now` 时实时计算，
 * 不读写缓存。
 */
export function resurfaceSuppressedRepoIds(userId: string, now?: number): Set<string> {
  const at = now ?? Date.now();
  if (now === undefined) {
    const cached = suppressedCache.get(userId);
    if (cached && at < cached.validUntil) {
      return cached.repoIds;
    }
  }
  const cutoff = at - RESURFACE_SUPPRESSION_MS;
  const repoIds = new Set<string>();
  let earliestAt = Number.POSITIVE_INFINITY;
  for (const [repoId, entry] of Object.entries(readResurfaceFeedback(userId).entries)) {
    if (entry.at > cutoff) {
      repoIds.add(repoId);
      earliestAt = Math.min(earliestAt, entry.at);
    }
  }
  if (now === undefined) {
    // 留存条目均满足 at > cutoff，故 validUntil 必定严格大于 at，重算可收敛。
    suppressedCache.set(userId, {
      repoIds,
      validUntil: earliestAt + RESURFACE_SUPPRESSION_MS,
    });
  }
  return repoIds;
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
