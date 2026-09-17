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
    update(value: unknown) {
      captured.value = value;
      return builder;
    },
    eq() {
      return builder;
    },
    select() {
      return builder;
    },
    maybeSingle() {
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

  it('rejects malformed transport responses', async () => {
    await expect(
      getMemory(detailClient({ data: { ...row, source: 'invented' }, error: null }), {
        userId: 'user-1',
        repoId: 'repo-1',
      }),
    ).rejects.toThrow('INVALID_MEMORY_RESPONSE');
  });
});
