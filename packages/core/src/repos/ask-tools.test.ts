import { describe, expect, it } from 'vitest';
import type { Memory } from '../models/memory';
import type { Repo } from '../models/repo';
import {
  ASK_SEARCH_DEFAULT_LIMIT,
  executeAskTool,
  expandAskRepos,
  filterAskRepos,
  searchAskRepos,
} from './ask-tools';
import type { StarredRepoLike } from './filter';

function item(
  repoId: string,
  overrides: Partial<Repo> & { starredAt?: string | null } = {},
): StarredRepoLike {
  const { starredAt, ...repo } = overrides;
  return {
    repoId,
    starredAt: starredAt ?? '2025-06-01T00:00:00Z',
    repo: {
      githubId: 1,
      fullName: `owner/${repoId}`,
      name: repoId,
      owner: 'owner',
      description: null,
      language: null,
      topics: [],
      stargazers: 10,
      forks: 0,
      homepage: null,
      pushedAt: null,
      repoCreatedAt: null,
      archived: false,
      isFork: false,
      syncedAt: '2026-01-01T00:00:00Z',
      ...repo,
    },
  };
}

const rustCli = item('axum', {
  fullName: 'tokio-rs/axum',
  name: 'axum',
  language: 'Rust',
  topics: ['web', 'http'],
  description: 'Ergonomic web framework',
  stargazers: 200,
});
const rustSearch = item('ripgrep', {
  fullName: 'BurntSushi/ripgrep',
  name: 'ripgrep',
  language: 'Rust',
  topics: ['cli', 'search'],
  description: 'Line-oriented search tool',
  stargazers: 400,
  starredAt: '2024-01-01T00:00:00Z',
});
const tsState = item('zustand', {
  fullName: 'pmndrs/zustand',
  name: 'zustand',
  language: 'TypeScript',
  topics: ['state', 'react'],
  description: 'Bear necessities for state management',
  stargazers: 150,
});

describe('filterAskRepos', () => {
  it('returns the complete matching set and pages with a total', () => {
    const result = filterAskRepos(
      { items: [rustCli, rustSearch, tsState] },
      { language: 'Rust', topics: ['cli'] },
    );
    expect(result.total).toBe(1);
    expect(result.items.map((hit) => hit.repoId)).toEqual(['ripgrep']);
    expect(result.hasMore).toBe(false);
  });

  it('filters by name and star date without a score floor', () => {
    const result = filterAskRepos(
      { items: [rustCli, rustSearch, tsState] },
      { nameContains: 'axum', starredAfter: '2025-01-01T00:00:00Z' },
    );
    expect(result.items.map((hit) => hit.repoId)).toEqual(['axum']);
  });
});

describe('searchAskRepos', () => {
  it('keeps weak lexical hits instead of applying a minimum score', () => {
    const hits = searchAskRepos({ items: [rustCli, rustSearch, tsState] }, { query: 'bear' });
    expect(hits.map((hit) => hit.repoId)).toEqual(['zustand']);
    expect(hits[0]?.score).toBe(2);
  });

  it('respects the default limit and ignores empty queries', () => {
    const many = Array.from({ length: 80 }, (_, index) =>
      item(`tool-${index}`, { description: 'websocket toolkit', stargazers: index }),
    );
    expect(searchAskRepos({ items: many }, { query: 'websocket' })).toHaveLength(
      ASK_SEARCH_DEFAULT_LIMIT,
    );
    expect(searchAskRepos({ items: many }, { query: 'the of' })).toEqual([]);
  });
});

describe('expandAskRepos', () => {
  const memory: Memory = {
    repoId: 'axum',
    source: 'github_star',
    sourceCreatedAt: null,
    whySaved: 'http experiments',
    note: 'used in prod',
  };

  it('returns full metadata and notes, skipping unknown or duplicate ids', () => {
    const expanded = expandAskRepos(
      { items: [rustCli, rustSearch], memoriesByRepoId: new Map([['axum', memory]]) },
      { ids: ['axum', 'missing', 'axum'] },
    );
    expect(expanded).toEqual([
      {
        repoId: 'axum',
        fullName: 'tokio-rs/axum',
        description: 'Ergonomic web framework',
        language: 'Rust',
        topics: ['web', 'http'],
        stargazers: 200,
        starredAt: '2025-06-01T00:00:00Z',
        whySaved: 'http experiments',
        note: 'used in prod',
      },
    ]);
  });

  it('omits notes when the user disabled them', () => {
    const expanded = expandAskRepos(
      {
        items: [rustCli],
        memoriesByRepoId: new Map([['axum', memory]]),
        includeNotes: false,
      },
      { ids: ['axum'] },
    );
    expect(expanded[0]?.whySaved).toBeNull();
    expect(expanded[0]?.note).toBeNull();
  });
});

describe('executeAskTool', () => {
  it('dispatches named tools and reports unknown names', () => {
    const context = { items: [rustCli, rustSearch, tsState] };
    const filtered = executeAskTool(context, 'filter', '{"language":"Rust"}');
    expect(filtered.ok).toBe(true);
    if (filtered.ok) {
      expect(filtered.expandedIds).toEqual([]);
    }
    const expanded = executeAskTool(context, 'expand', '{"ids":["axum"]}');
    expect(expanded).toMatchObject({ ok: true, expandedIds: ['axum'] });
    expect(executeAskTool(context, 'search', 'not-json')).toEqual({
      ok: false,
      error: 'invalid_json',
    });
    expect(executeAskTool(context, 'nope', '{}')).toEqual({ ok: false, error: 'unknown_tool' });
  });
});
