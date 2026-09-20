import { describe, expect, it, vi } from 'vitest';
import { ensureUserMemories, type MemorySyncStore } from './memory-sync';

function store(overrides: Partial<MemorySyncStore> = {}): MemorySyncStore {
  return {
    repairMemories: vi.fn().mockResolvedValue({ data: 3, error: null }),
    ...overrides,
  };
}

describe('ensureUserMemories', () => {
  it('repairs the calling user Memories and reports the affected row count', async () => {
    const memoryStore = store();

    await expect(ensureUserMemories(memoryStore, 'user-1')).resolves.toBe(3);
    expect(memoryStore.repairMemories).toHaveBeenCalledWith('user-1');
  });

  it('treats a missing count as zero rather than failing the sync', async () => {
    const memoryStore = store({
      repairMemories: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    await expect(ensureUserMemories(memoryStore, 'user-1')).resolves.toBe(0);
  });

  it('can retry the repair after a transient failure', async () => {
    const repairMemories = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { message: 'temporary outage' } })
      .mockResolvedValueOnce({ data: 1, error: null });
    const memoryStore = store({ repairMemories });

    await expect(ensureUserMemories(memoryStore, 'user-1')).rejects.toThrow('temporary outage');
    await expect(ensureUserMemories(memoryStore, 'user-1')).resolves.toBe(1);
    expect(repairMemories).toHaveBeenCalledTimes(2);
  });
});
