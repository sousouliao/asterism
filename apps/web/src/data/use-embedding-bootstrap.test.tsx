// @vitest-environment happy-dom

import type { Memory } from '@asterism/core';
import type { StarredRepoRecord } from '@asterism/db';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { embeddingOptInStorageKey, resetEmbeddingConsentState } from '../lib/embedding-consent';
import { embeddingKeys } from './keys';
import { useEmbeddingBootstrap } from './use-embedding-bootstrap';

const mocks = vi.hoisted(() => ({
  listReposToEmbed: vi.fn(),
  session: { current: { user: { id: 'user-a' } } as { user: { id: string } } | null },
  upsertRepoEmbedding: vi.fn(),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@asterism/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@asterism/db')>()),
  listReposToEmbed: mocks.listReposToEmbed,
  upsertRepoEmbedding: mocks.upsertRepoEmbedding,
}));

vi.mock('../auth/use-session', () => ({
  useSession: () => ({ session: mocks.session.current }),
}));

function record(repoId: string): StarredRepoRecord {
  return {
    repoId,
    starredAt: '2026-07-24T00:00:00.000Z',
    repo: {
      githubId: Number(repoId.replace(/\D/g, '')) || 1,
      fullName: `owner/${repoId}`,
      name: repoId,
      owner: 'owner',
      description: null,
      language: null,
      topics: [],
      stargazers: 0,
      forks: 0,
      homepage: null,
      pushedAt: null,
      repoCreatedAt: null,
      archived: false,
      isFork: false,
      syncedAt: '2026-07-24T00:00:00.000Z',
    },
  };
}

let root: Root | undefined;
let container: HTMLDivElement | undefined;
let queryClient: QueryClient;

function Harness({
  records,
  memoriesByRepoId,
}: {
  records: readonly StarredRepoRecord[];
  memoriesByRepoId?: Map<string, Memory>;
}) {
  useEmbeddingBootstrap(records, memoriesByRepoId);
  return null;
}

async function render(
  records: readonly StarredRepoRecord[],
  memoriesByRepoId?: Map<string, Memory>,
) {
  if (!container) {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  }
  await act(async () => {
    root?.render(
      <QueryClientProvider client={queryClient}>
        <Harness records={records} memoriesByRepoId={memoriesByRepoId} />
      </QueryClientProvider>,
    );
    await Promise.resolve();
  });
}

beforeEach(() => {
  localStorage.clear();
  resetEmbeddingConsentState();
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  mocks.listReposToEmbed.mockReset();
  mocks.upsertRepoEmbedding.mockReset();
  mocks.session.current = { user: { id: 'user-a' } };
});

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
  }
  container?.remove();
  root = undefined;
  container = undefined;
});

describe('useEmbeddingBootstrap', () => {
  it('does not carry opt-in or async state across users', async () => {
    localStorage.setItem(embeddingOptInStorageKey('user-a'), 'enabled');
    mocks.listReposToEmbed.mockResolvedValue([]);

    await render([record('repo-1')]);
    expect(mocks.listReposToEmbed).toHaveBeenCalledTimes(1);
    expect(mocks.listReposToEmbed.mock.calls[0]?.[1]).toMatchObject({ userId: 'user-a' });

    mocks.session.current = { user: { id: 'user-b' } };
    await render([record('repo-1')]);

    expect(mocks.listReposToEmbed).toHaveBeenCalledTimes(1);
  });

  it('queues a follow-up pass when records change during a running pass', async () => {
    localStorage.setItem(embeddingOptInStorageKey('user-a'), 'enabled');
    let resolveFirst: ((value: []) => void) | undefined;
    mocks.listReposToEmbed
      .mockImplementationOnce(
        () =>
          new Promise<[]>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce([]);

    await render([record('repo-1')]);
    expect(mocks.listReposToEmbed).toHaveBeenCalledTimes(1);

    await render([record('repo-1'), record('repo-2')]);
    await act(async () => {
      resolveFirst?.([]);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.listReposToEmbed).toHaveBeenCalledTimes(2);
    expect(mocks.listReposToEmbed.mock.calls[1]?.[1]?.desired).toHaveLength(2);
  });

  it('queues a fresh embedding pass when Memory changes', async () => {
    localStorage.setItem(embeddingOptInStorageKey('user-a'), 'enabled');
    mocks.listReposToEmbed.mockResolvedValue([]);
    const records = [record('repo-1')];

    await render(records, new Map());
    await vi.waitFor(() => expect(mocks.listReposToEmbed).toHaveBeenCalledTimes(1));

    const memories = new Map<string, Memory>([
      [
        'repo-1',
        {
          repoId: 'repo-1',
          source: 'github_star',
          sourceCreatedAt: null,
          whySaved: '用于检索回归验证',
          note: null,
        },
      ],
    ]);
    await render(records, memories);

    await vi.waitFor(() => expect(mocks.listReposToEmbed).toHaveBeenCalledTimes(2));
    const firstHash = mocks.listReposToEmbed.mock.calls[0]?.[1]?.desired[0]?.contentHash;
    const secondHash = mocks.listReposToEmbed.mock.calls[1]?.[1]?.desired[0]?.contentHash;
    expect(secondHash).not.toBe(firstHash);
  });

  it('invalidates the embedding list after a preparation pass completes', async () => {
    localStorage.setItem(embeddingOptInStorageKey('user-a'), 'enabled');
    mocks.listReposToEmbed.mockResolvedValue([]);
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    await render([record('repo-1')]);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: embeddingKeys.list('user-a'),
    });
  });
});
