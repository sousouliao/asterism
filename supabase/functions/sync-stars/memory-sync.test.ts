import { describe, expect, it, vi } from 'vitest';
import { ensureUserMemories, type MemorySyncStore } from './memory-sync';

function store(overrides: Partial<MemorySyncStore> = {}): MemorySyncStore {
  return {
    listUserStars: vi.fn().mockResolvedValue({
      data: [{ repo_id: 'repo-1', starred_at: '2026-09-17T00:00:00.000Z' }],
      error: null,
    }),
    insertMissingMemories: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  };
}

describe('ensureUserMemories', () => {
  it('creates base Memories from Star source data', async () => {
    const memoryStore = store();

    await expect(ensureUserMemories(memoryStore, 'user-1')).resolves.toBe(1);
    expect(memoryStore.insertMissingMemories).toHaveBeenCalledWith([
      {
        user_id: 'user-1',
        repo_id: 'repo-1',
        source: 'github_star',
        source_created_at: '2026-09-17T00:00:00.000Z',
      },
    ]);
  });

  it('can retry the same repair set after a transient insert failure', async () => {
    const insertMissingMemories = vi
      .fn()
      .mockResolvedValueOnce({ error: { message: 'temporary outage' } })
      .mockResolvedValueOnce({ error: null });
    const memoryStore = store({ insertMissingMemories });

    await expect(ensureUserMemories(memoryStore, 'user-1')).rejects.toThrow('temporary outage');
    await expect(ensureUserMemories(memoryStore, 'user-1')).resolves.toBe(1);
    expect(insertMissingMemories).toHaveBeenCalledTimes(2);
  });
});
