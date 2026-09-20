// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RESURFACE_SUPPRESSION_MS,
  readResurfaceFeedback,
  recordResurfaceFeedback,
  resetResurfaceFeedbackState,
  resurfaceFeedbackStorageKey,
  resurfaceSuppressedRepoIds,
  subscribeResurfaceFeedback,
} from './resurface-feedback';

const NOW = Date.parse('2026-06-30T00:00:00Z');
const USER = 'user-1';

describe('resurface feedback persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    resetResurfaceFeedbackState();
  });

  it('returns an empty store when nothing is recorded', () => {
    expect(readResurfaceFeedback(USER)).toEqual({ version: 1, entries: {} });
    expect(resurfaceSuppressedRepoIds(USER, NOW)).toEqual(new Set());
  });

  it('persists feedback per user under a versioned key', () => {
    recordResurfaceFeedback(USER, 'r1', 'dismissed', NOW);
    expect(localStorage.getItem(resurfaceFeedbackStorageKey(USER))).toBe(
      JSON.stringify({ version: 1, entries: { r1: { action: 'dismissed', at: NOW } } }),
    );
  });

  it('suppresses recorded repos within the 90-day window and releases them after', () => {
    recordResurfaceFeedback(USER, 'r1', 'useful', NOW);
    expect(resurfaceSuppressedRepoIds(USER, NOW + RESURFACE_SUPPRESSION_MS - 1)).toEqual(
      new Set(['r1']),
    );
    expect(resurfaceSuppressedRepoIds(USER, NOW + RESURFACE_SUPPRESSION_MS)).toEqual(new Set());
  });

  it('overwrites repeat feedback for the same repo and prunes expired entries on write', () => {
    recordResurfaceFeedback(USER, 'r1', 'dismissed', NOW);
    recordResurfaceFeedback(USER, 'r2', 'useful', NOW + 10 * 24 * 60 * 60 * 1000);
    recordResurfaceFeedback(USER, 'r1', 'useful', NOW + 95 * 24 * 60 * 60 * 1000);

    const store = readResurfaceFeedback(USER);
    expect(Object.keys(store.entries)).toEqual(['r2', 'r1']);
    expect(store.entries.r1).toEqual({ action: 'useful', at: NOW + 95 * 24 * 60 * 60 * 1000 });
  });

  it('isolates feedback between users', () => {
    recordResurfaceFeedback(USER, 'r1', 'dismissed', NOW);
    expect(resurfaceSuppressedRepoIds('user-2', NOW)).toEqual(new Set());
  });

  it('releases a cached suppression once its window expires', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(NOW);
      recordResurfaceFeedback(USER, 'r1', 'useful', NOW);
      // 首次读取建立缓存快照。
      expect(resurfaceSuppressedRepoIds(USER)).toEqual(new Set(['r1']));
      // 缓存内重复读取复用同一引用，供 useSyncExternalStore 稳定比较。
      expect(resurfaceSuppressedRepoIds(USER)).toBe(resurfaceSuppressedRepoIds(USER));

      // 回归：缓存过去永不过期，用户不再提交反馈则该仓库永远无法重新浮现。
      vi.setSystemTime(NOW + RESURFACE_SUPPRESSION_MS);
      expect(resurfaceSuppressedRepoIds(USER)).toEqual(new Set());
    } finally {
      vi.useRealTimers();
    }
  });

  it('drops cached state when another tab records feedback', () => {
    recordResurfaceFeedback(USER, 'r1', 'useful', NOW);
    // 订阅后才会挂上 storage 监听；useResurfaceSuppressedRepoIds 在组件挂载时完成。
    const unsubscribe = subscribeResurfaceFeedback(() => {});
    try {
      localStorage.setItem(
        resurfaceFeedbackStorageKey(USER),
        JSON.stringify({ version: 1, entries: { r2: { action: 'dismissed', at: NOW } } }),
      );
      window.dispatchEvent(new StorageEvent('storage', { key: resurfaceFeedbackStorageKey(USER) }));

      expect(resurfaceSuppressedRepoIds(USER, NOW)).toEqual(new Set(['r2']));
    } finally {
      unsubscribe();
    }
  });

  it('ignores corrupted storage instead of throwing', () => {
    localStorage.setItem(resurfaceFeedbackStorageKey(USER), '{not json');
    expect(readResurfaceFeedback(USER)).toEqual({ version: 1, entries: {} });

    localStorage.setItem(
      resurfaceFeedbackStorageKey(USER),
      JSON.stringify({ version: 1, entries: { r1: { action: 'mystery', at: 'yesterday' } } }),
    );
    resetResurfaceFeedbackState();
    expect(readResurfaceFeedback(USER)).toEqual({ version: 1, entries: {} });
  });
});
