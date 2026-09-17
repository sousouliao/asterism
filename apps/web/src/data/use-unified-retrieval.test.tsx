// @vitest-environment happy-dom

import type { Memory } from '@asterism/core';
import type { StarredRepoRecord } from '@asterism/db';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type UnifiedRetrievalResult, useUnifiedRetrieval } from './use-unified-retrieval';

const mocks = vi.hoisted(() => ({
  distanceByRepoId: new Map<string, number>(),
  isSearching: false,
}));

vi.mock('./use-semantic-search', () => ({
  SEMANTIC_MATCH_COUNT: 24,
  useSemanticNeighbors: () => ({
    distanceByRepoId: mocks.distanceByRepoId,
    isSearching: mocks.isSearching,
  }),
}));

function makeRepo(id: string, name: string, desc = '', topics: string[] = []): StarredRepoRecord {
  return {
    repoId: id,
    starredAt: '2026-01-01T00:00:00Z',
    repo: {
      githubId: Number(id.replace(/\D/g, '')) || 1,
      fullName: `owner/${name}`,
      owner: 'owner',
      name,
      description: desc,
      language: 'TypeScript',
      topics,
      stargazers: 100,
      forks: 10,
      homepage: null,
      pushedAt: null,
      repoCreatedAt: null,
      archived: false,
      isFork: false,
      syncedAt: '2026-01-01T00:00:00Z',
    },
  };
}

let root: Root | undefined;
let container: HTMLDivElement | undefined;
let queryClient: QueryClient | undefined;
let latest: UnifiedRetrievalResult | undefined;

function Harness(props: Parameters<typeof useUnifiedRetrieval>[0]) {
  latest = useUnifiedRetrieval(props);
  return null;
}

async function render(props: Parameters<typeof useUnifiedRetrieval>[0]) {
  if (!container) {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  }
  await act(async () => {
    root?.render(
      <QueryClientProvider client={queryClient as QueryClient}>
        <Harness {...props} />
      </QueryClientProvider>,
    );
    await Promise.resolve();
  });
}

beforeEach(() => {
  mocks.distanceByRepoId = new Map();
  mocks.isSearching = false;
  latest = undefined;
});

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
  }
  container?.remove();
  queryClient?.clear();
  root = undefined;
  container = undefined;
  queryClient = undefined;
});

describe('useUnifiedRetrieval', () => {
  const records = [
    makeRepo('r1', 'react-router', 'Declarative routing', ['react', 'router']),
    makeRepo('r2', 'tanstack-query', 'Async state manager', ['react', 'state']),
    makeRepo('r3', 'hidden-gem', 'A tool with no special description', ['cli']),
  ];

  const memoriesByRepoId = new Map<string, Memory>([
    [
      'r3',
      {
        repoId: 'r3',
        source: 'github_star',
        sourceCreatedAt: null,
        whySaved: '团队内部数据同步方案',
        note: '支持断点续传',
      },
    ],
  ]);

  it('returns all records when query is empty', async () => {
    await render({
      records,
      filter: { query: '' },
      sort: 'stars',
      semanticEnabled: false,
    });

    expect(latest?.primary.length).toBe(3);
    expect(latest?.semantic.length).toBe(0);
    expect(latest?.explanations.size).toBe(0);
  });

  it('matches memory whySaved and note and generates match explanation', async () => {
    await render({
      records,
      filter: { query: '数据同步' },
      sort: 'stars',
      memoriesByRepoId,
      semanticEnabled: false,
    });

    expect(latest?.primary.map((r) => r.repoId)).toEqual(['r3']);
    const explanation = latest?.explanations.get('r3');
    expect(explanation).toBeDefined();
    expect(explanation?.primaryReason.kind).toBe('why_saved');
    expect(explanation?.primaryReason.snippet).toContain('数据同步');
  });

  it('combines primary keyword matches with semantic neighbors and reasons', async () => {
    mocks.distanceByRepoId = new Map([
      ['r2', 0.15],
      ['r3', 0.25],
    ]);

    await render({
      records,
      filter: { query: 'routing' },
      sort: 'stars',
      memoriesByRepoId,
      semanticEnabled: true,
    });

    // r1 matches routing via description
    expect(latest?.primary.map((r) => r.repoId)).toEqual(['r1']);
    // r2 and r3 come in via semantic distance
    expect(latest?.semantic.map((r) => r.repoId)).toEqual(['r2', 'r3']);
    expect(latest?.semanticStartIndex).toBe(1);

    expect(latest?.explanations.get('r1')?.primaryReason.kind).toBe('description');
    expect(latest?.explanations.get('r2')?.primaryReason.kind).toBe('semantic_repo');
    expect(latest?.explanations.get('r3')?.primaryReason.kind).toBe('semantic_memory');
  });
});
