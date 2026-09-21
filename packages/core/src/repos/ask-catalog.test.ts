import { describe, expect, it } from 'vitest';
import type { Repo } from '../models/repo';
import {
  ASK_CATALOG_COMPACT_MAX,
  ASK_CATALOG_FULL_MAX,
  buildAskCatalog,
  classifyAskCatalogTier,
} from './ask-catalog';
import type { StarredRepoLike } from './filter';

function item(
  repoId: string,
  overrides: Partial<Repo> & { starredAt?: string | null } = {},
): StarredRepoLike {
  const { starredAt, ...repo } = overrides;
  return {
    repoId,
    starredAt: starredAt ?? '2025-01-01T00:00:00Z',
    repo: {
      githubId: 1,
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
      syncedAt: '2026-01-01T00:00:00Z',
      ...repo,
    },
  };
}

describe('classifyAskCatalogTier', () => {
  it('picks full, compact, then grouped by collection size', () => {
    expect(classifyAskCatalogTier(0)).toBe('full');
    expect(classifyAskCatalogTier(ASK_CATALOG_FULL_MAX)).toBe('full');
    expect(classifyAskCatalogTier(ASK_CATALOG_FULL_MAX + 1)).toBe('compact');
    expect(classifyAskCatalogTier(ASK_CATALOG_COMPACT_MAX)).toBe('compact');
    expect(classifyAskCatalogTier(ASK_CATALOG_COMPACT_MAX + 1)).toBe('grouped');
  });
});

describe('buildAskCatalog', () => {
  it('emits a stable full catalog with truncated descriptions and skips items without repoId', () => {
    const long = 'x'.repeat(120);
    const catalog = buildAskCatalog({
      items: [
        item('b', {
          fullName: 'z/b',
          name: 'b',
          stargazers: 10,
          description: 'short',
          language: 'Rust',
        }),
        item('a', {
          fullName: 'a/a',
          name: 'a',
          stargazers: 10,
          description: long,
          language: 'Rust',
          topics: ['cli'],
        }),
        { repo: item('ghost').repo, starredAt: null },
      ],
    });
    expect(catalog.tier).toBe('full');
    expect(catalog.repoIds).toEqual(['a', 'b']);
    expect(catalog.text).toContain('Collection catalog (full, 2 repositories):');
    expect(catalog.text).toContain('a | a/a | Rust | cli |');
    expect(catalog.text).toContain('…');
    expect(catalog.text).not.toContain(long);
    expect(catalog.estimatedTokens).toBeGreaterThan(0);
    const sameItems = [
      item('b', {
        fullName: 'z/b',
        name: 'b',
        stargazers: 10,
        description: 'short',
        language: 'Rust',
      }),
      item('a', {
        fullName: 'a/a',
        name: 'a',
        stargazers: 10,
        description: long,
        language: 'Rust',
        topics: ['cli'],
      }),
    ];
    expect(buildAskCatalog({ items: sameItems }).text).toBe(catalog.text);
  });

  it('groups large collections by language and topic with counts', () => {
    const items = Array.from({ length: ASK_CATALOG_COMPACT_MAX + 1 }, (_, index) =>
      item(`r${index}`, {
        fullName: `owner/r${index}`,
        name: `r${index}`,
        language: index % 2 === 0 ? 'Rust' : 'Go',
        topics: index % 3 === 0 ? ['cli'] : ['web'],
        stargazers: index,
      }),
    );
    const catalog = buildAskCatalog({ items });
    expect(catalog.tier).toBe('grouped');
    expect(catalog.text).toContain(`Collection catalog (grouped, ${items.length} repositories):`);
    expect(catalog.text).toMatch(/Rust \(\d+\)/);
    expect(catalog.text).toContain('cli(');
    expect(catalog.repoIds).toHaveLength(items.length);
  });
});
