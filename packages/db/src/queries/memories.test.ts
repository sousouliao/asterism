import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '../client';
import { getMemory, listMemories, saveMemory } from './memories';

function detailClient(result: { data: unknown; error: unknown }) {
  const builder = {
    select() {
      return builder;
    },
    eq() {
      return builder;
    },
    maybeSingle() {
      return Promise.resolve(result);
    },
  };
  return { from: () => builder } as unknown as SupabaseClient;
}

function listClient(result: { data: unknown; error: unknown }) {
  const builder = {
    select() {
      return builder;
    },
    eq() {
      return builder;
    },
    order() {
      return builder;
    },
    range() {
      return Promise.resolve(result);
    },
  };
  return { from: () => builder } as unknown as SupabaseClient;
}

function saveClient(result: { data: unknown; error: unknown }, captured: Record<string, unknown>) {
  const builder = {
    upsert(value: unknown, options: unknown) {
      captured.value = value;
      captured.options = options;
      return builder;
    },
    select() {
      return builder;
    },
    single() {
      return Promise.resolve(result);
    },
  };
  return { from: () => builder } as unknown as SupabaseClient;
}

const row = {
  repo_id: 'repo-1',
  source: 'github_star',
  source_created_at: '2026-09-17T00:00:00.000Z',
  why_saved: 'Local-first research',
  note: 'Try this later',
};

describe('memory queries', () => {
  it('maps detail and list responses into the domain model', async () => {
    const detail = await getMemory(detailClient({ data: row, error: null }), {
      userId: 'user-1',
      repoId: 'repo-1',
    });
    const list = await listMemories(listClient({ data: [row], error: null }), 'user-1');

    expect(detail).toEqual({
      repoId: 'repo-1',
      source: 'github_star',
      sourceCreatedAt: '2026-09-17T00:00:00.000Z',
      whySaved: 'Local-first research',
      note: 'Try this later',
    });
    expect(list).toEqual([detail]);
  });

  it('normalizes cleared personal fields to null without deleting the Memory', async () => {
    const captured: Record<string, unknown> = {};
    await saveMemory(
      saveClient({ data: { ...row, why_saved: null, note: null }, error: null }, captured),
      { userId: 'user-1', repoId: 'repo-1', whySaved: '  ', note: '' },
    );

    expect(captured.value).toMatchObject({
      why_saved: null,
      note: null,
    });
  });

  it('saves through a single conflict-aware write instead of read-then-insert', async () => {
    const captured: Record<string, unknown> = {};
    await saveMemory(saveClient({ data: row, error: null }, captured), {
      userId: 'user-1',
      repoId: 'repo-1',
      whySaved: 'why',
      note: 'note',
    });

    // 并发保存（多标签页，或 sync 正好补齐基础 Memory）必须靠唯一键冲突解决，
    // 而不是先 update 再 insert 留下的竞态窗口。
    expect(captured.options).toEqual({ onConflict: 'user_id,repo_id' });
    // 载荷不含 source_created_at：冲突更新不得覆盖 sync 写入的收藏时间。
    expect(captured.value).not.toHaveProperty('source_created_at');
  });

  it('rejects malformed transport responses', async () => {
    await expect(
      getMemory(detailClient({ data: { ...row, source: 'invented' }, error: null }), {
        userId: 'user-1',
        repoId: 'repo-1',
      }),
    ).rejects.toThrow('INVALID_MEMORY_RESPONSE');
  });
});
