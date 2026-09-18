import { DEFAULT_EMBEDDING_DIMENSIONS, DEFAULT_EMBEDDING_MODEL } from '@asterism/core';
import type { StarredRepoRecord } from '@asterism/db';
import { describe, expect, it } from 'vitest';
import { runRepositoryEmbeddingBootstrap } from './embedding-bootstrap';
import { embeddingOptInStorageKey } from './embedding-consent';

const record: StarredRepoRecord = {
  repoId: 'repo-1',
  starredAt: '2026-07-24T00:00:00Z',
  repo: {
    githubId: 1,
    fullName: 'owner/search',
    name: 'search',
    owner: 'owner',
    description: '多语言 repository search',
    language: 'TypeScript',
    topics: ['semantic-search'],
    stargazers: 10,
    forks: 1,
    homepage: null,
    pushedAt: null,
    repoCreatedAt: null,
    archived: false,
    isFork: false,
    syncedAt: '2026-07-24T00:00:00Z',
  },
};

describe('runRepositoryEmbeddingBootstrap', () => {
  it('is a near no-op when the derived table is already fresh', async () => {
    let prepareCalls = 0;
    let embedCalls = 0;

    const result = await runRepositoryEmbeddingBootstrap({
      records: [record],
      listPending: async () => [],
      prepare: async () => {
        prepareCalls += 1;
        return { backend: 'webgpu' };
      },
      embedBatch: async () => {
        embedCalls += 1;
        return [];
      },
      persist: async () => {},
    });

    expect(result).toEqual({ backend: null, completed: 0, total: 0 });
    expect(prepareCalls).toBe(0);
    expect(embedCalls).toBe(0);
  });

  it('uses passage-prefixed text and persists current model/hash through the owner path', async () => {
    const embeddedInputs: string[][] = [];
    const writes: Array<{
      repoId: string;
      embeddingModel: string;
      contentHash: string;
      dimensions: number;
    }> = [];

    const result = await runRepositoryEmbeddingBootstrap({
      records: [record],
      listPending: async (desired) => [{ repoId: desired[0]?.repoId ?? '', reason: 'missing' }],
      prepare: async () => ({ backend: 'wasm' }),
      embedBatch: async (inputs) => {
        embeddedInputs.push([...inputs]);
        return inputs.map(() => Array.from({ length: DEFAULT_EMBEDDING_DIMENSIONS }, () => 0.5));
      },
      persist: async (write) => {
        writes.push({
          repoId: write.repoId,
          embeddingModel: write.embeddingModel,
          contentHash: write.contentHash,
          dimensions: write.embedding.length,
        });
      },
    });

    expect(embeddedInputs).toEqual([
      ['passage: owner/search\n多语言 repository search\nsemantic-search'],
    ]);
    expect(writes).toEqual([
      {
        repoId: 'repo-1',
        embeddingModel: DEFAULT_EMBEDDING_MODEL,
        contentHash: expect.stringMatching(/^[0-9a-f]{16}$/),
        dimensions: DEFAULT_EMBEDDING_DIMENSIONS,
      },
    ]);
    expect(result).toEqual({ backend: 'wasm', completed: 1, total: 1 });
  });
});

describe('embeddingOptInStorageKey', () => {
  it('versions consent per user and model so a future model upgrade asks again', () => {
    expect(embeddingOptInStorageKey('user-1')).toBe(
      `asterism:embedding-bootstrap:v2:user-1:${DEFAULT_EMBEDDING_MODEL}`,
    );
  });
});
