// @vitest-environment happy-dom

import { DEFAULT_EMBEDDING_MODEL, repoContentHash } from '@asterism/core';
import type { RepoEmbeddingRecord, StarredRepoRecord } from '@asterism/db';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  beginEmbeddingPreparation,
  embeddingOptInStorageKey,
  finishEmbeddingPreparation,
  resetEmbeddingConsentState,
} from '../lib/embedding-consent';
import { selectSemanticNeighborhood, useSemanticNeighborhood } from './use-semantic-neighborhood';

const mocks = vi.hoisted(() => {
  const embeddings: RepoEmbeddingRecord[] = [];
  const starredRepos: StarredRepoRecord[] = [];
  return {
    embeddings,
    listRepoEmbeddings: vi.fn(),
    starredRepos,
  };
});

vi.mock('@asterism/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@asterism/db')>()),
  listRepoEmbeddings: mocks.listRepoEmbeddings,
}));

vi.mock('../auth/use-session', () => ({
  useSession: () => ({ session: { user: { id: 'user-a' } } }),
}));

vi.mock('./use-starred-repos', () => ({
  useStarredRepos: () => ({ data: mocks.starredRepos }),
}));

vi.mock('./use-memories-list', () => ({
  useMemoriesList: () => ({ data: [] }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function starred(repoId: string, name: string): StarredRepoRecord {
  return {
    repoId,
    starredAt: null,
    repo: {
      githubId: Number(repoId.replace(/\D/g, '')) || 1,
      fullName: `owner/${name}`,
      owner: 'owner',
      name,
      description: `${name} description`,
      language: 'TypeScript',
      topics: [name],
      stargazers: 1,
      forks: 0,
      homepage: null,
      pushedAt: null,
      repoCreatedAt: null,
      archived: false,
      isFork: false,
      syncedAt: '2026-07-27T00:00:00Z',
    },
  };
}

function embedding(record: StarredRepoRecord, vector: number[]): RepoEmbeddingRecord {
  return {
    repoId: record.repoId,
    embedding: vector,
    embeddingModel: DEFAULT_EMBEDDING_MODEL,
    contentHash: repoContentHash(record.repo),
  };
}

describe('selectSemanticNeighborhood', () => {
  it('maps fresh reciprocal vectors back to starred repository records', () => {
    const anchor = starred('repo-1', 'anchor');
    const related = starred('repo-2', 'related');
    const records = [anchor, related];

    expect(
      selectSemanticNeighborhood('repo-1', records, [
        embedding(anchor, [1, 0]),
        embedding(related, [0.99, 0.1]),
      ]).map((record) => record.repoId),
    ).toEqual(['repo-2']);
  });

  it('silently excludes stale and unknown embeddings', () => {
    const anchorRecord = starred('repo-1', 'anchor');
    const relatedRecord = starred('repo-2', 'related');
    const records = [anchorRecord, relatedRecord];
    const anchor = embedding(anchorRecord, [1, 0]);
    const stale = {
      ...embedding(relatedRecord, [0.99, 0.1]),
      contentHash: 'stale',
    };

    expect(
      selectSemanticNeighborhood('repo-1', records, [
        anchor,
        stale,
        {
          repoId: 'unknown',
          embedding: [1, 0],
          embeddingModel: DEFAULT_EMBEDDING_MODEL,
          contentHash: 'unknown',
        },
      ]),
    ).toEqual([]);
  });
});

describe('useSemanticNeighborhood', () => {
  beforeEach(() => {
    localStorage.clear();
    resetEmbeddingConsentState();
    mocks.listRepoEmbeddings.mockReset();
    const anchor = starred('repo-1', 'anchor');
    const related = starred('repo-2', 'related');
    mocks.starredRepos = [anchor, related];
    mocks.embeddings = [embedding(anchor, [1, 0]), embedding(related, [0.99, 0.1])];
    mocks.listRepoEmbeddings.mockImplementation(() => Promise.resolve(mocks.embeddings));
  });

  it('stays empty while embeddings are preparing and reads them after completion', async () => {
    localStorage.setItem(embeddingOptInStorageKey('user-a'), 'enabled');
    const preparationToken = beginEmbeddingPreparation('user-a', false);
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    function Harness() {
      return <span>{useSemanticNeighborhood('repo-1').length}</span>;
    }

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>,
      );
    });
    expect(container.textContent).toBe('0');
    expect(mocks.listRepoEmbeddings).not.toHaveBeenCalled();

    await act(async () => {
      finishEmbeddingPreparation('user-a', preparationToken, true);
      await vi.waitFor(() => {
        expect(container.textContent).toBe('1');
      });
    });
    expect(mocks.listRepoEmbeddings).toHaveBeenCalledTimes(1);

    await act(async () => root.unmount());
    container.remove();
  });

  it('uses local fallback when embedding preparation degrades', async () => {
    const related = mocks.starredRepos[1];
    if (related) {
      related.repo.topics = ['anchor'];
    }
    const preparationToken = beginEmbeddingPreparation('user-a', true);
    finishEmbeddingPreparation('user-a', preparationToken, false);
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    function Harness() {
      return <span>{useSemanticNeighborhood('repo-1').length}</span>;
    }

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>,
      );
    });

    expect(container.textContent).toBe('1');
    expect(mocks.listRepoEmbeddings).not.toHaveBeenCalled();

    await act(async () => root.unmount());
    container.remove();
  });
});
