import { describe, expect, it } from 'vitest';
import type { Memory } from '../models/memory';
import type { Repo } from '../models/repo';
import {
  findKeywordFallbackNeighbors,
  findMutualSemanticNeighbors,
  type RepoSemanticVector,
} from './semantic-neighborhood';

function vector(repoId: string, embedding: number[]): RepoSemanticVector {
  return { repoId, embedding };
}

function makeRepo(overrides: Partial<Repo>): Repo {
  return {
    githubId: 1,
    fullName: 'owner/name',
    name: 'name',
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
    ...overrides,
  };
}

describe('findMutualSemanticNeighbors', () => {
  it('returns only reciprocal nearest neighbors in similarity order', () => {
    const vectors = [
      vector('anchor', [1, 0]),
      vector('close', [0.99, 0.1]),
      vector('also-close', [0.96, 0.2]),
    ];

    expect(findMutualSemanticNeighbors(vectors, 'anchor').map((item) => item.repoId)).toEqual([
      'close',
      'also-close',
    ]);
  });

  it('rejects a one-way neighbor instead of filling the result list', () => {
    const decoys = Array.from({ length: 12 }, (_, index) => {
      const angle = ((40 + index * 2) * Math.PI) / 180;
      return vector(`decoy-${index}`, [Math.cos(angle), Math.sin(angle)]);
    });
    const vectors = [vector('anchor', [1, 0]), vector('one-way', [0.8, 0.6]), ...decoys];

    expect(findMutualSemanticNeighbors(vectors, 'anchor')).toEqual([]);
  });

  it('is deterministic when similarities tie', () => {
    const vectors = [vector('anchor', [1, 0]), vector('z-repo', [1, 0]), vector('a-repo', [1, 0])];

    expect(findMutualSemanticNeighbors(vectors, 'anchor').map((item) => item.repoId)).toEqual([
      'a-repo',
      'z-repo',
    ]);
  });

  it('returns an empty neighborhood for missing or unusable vectors', () => {
    expect(findMutualSemanticNeighbors([vector('other', [1, 0])], 'missing')).toEqual([]);
    expect(
      findMutualSemanticNeighbors([vector('anchor', [0, 0]), vector('other', [1, 0])], 'anchor'),
    ).toEqual([]);
  });

  it('deduplicates repositories and respects the result limit', () => {
    const vectors = [
      vector('anchor', [1, 0]),
      vector('b', [0.99, 0.1]),
      vector('b', [0, 1]),
      vector('c', [0.98, 0.15]),
      vector('d', [0.97, 0.2]),
      vector('e', [0.96, 0.25]),
      vector('f', [0.95, 0.3]),
      vector('g', [0.94, 0.35]),
    ];

    expect(findMutualSemanticNeighbors(vectors, 'anchor')).toHaveLength(5);
  });

  it('applies memory alignment bonus when both repositories have personal memory', () => {
    // b has slightly lower base similarity than c, but anchor and b both have personal memories
    const vectors = [vector('anchor', [1, 0]), vector('b', [0.95, 0.3]), vector('c', [0.96, 0.2])];

    const memories: Map<string, Memory> = new Map([
      [
        'anchor',
        {
          repoId: 'anchor',
          source: 'github_star',
          sourceCreatedAt: null,
          whySaved: '微服务网关',
          note: null,
        },
      ],
      [
        'b',
        {
          repoId: 'b',
          source: 'github_star',
          sourceCreatedAt: null,
          whySaved: '网关替代方案',
          note: null,
        },
      ],
    ]);

    // Without options: c (similarity higher) is ranked before b
    const withoutOptions = findMutualSemanticNeighbors(vectors, 'anchor');
    expect(withoutOptions.map((n) => n.repoId)).toEqual(['c', 'b']);

    // With memoriesByRepoId: b receives bonus (0.95 + 0.03 = 0.98 > c)
    const withOptions = findMutualSemanticNeighbors(vectors, 'anchor', {
      memoriesByRepoId: memories,
      memoryWeightBonus: 0.05,
    });
    expect(withOptions.map((n) => n.repoId)).toEqual(['b', 'c']);
  });
});

describe('findKeywordFallbackNeighbors', () => {
  const anchorRepo = makeRepo({
    fullName: 'my/anchor',
    language: 'TypeScript',
    topics: ['react', 'search', 'engine'],
  });

  const items = [
    {
      repoId: 'r-topic',
      repo: makeRepo({
        fullName: 'org/topic-heavy',
        language: 'Rust',
        topics: ['react', 'search'],
      }),
    },
    {
      repoId: 'r-lang',
      repo: makeRepo({
        fullName: 'org/lang-only',
        language: 'TypeScript',
        topics: ['graphql'],
      }),
    },
    {
      repoId: 'r-memory',
      repo: makeRepo({
        fullName: 'org/memory-shared',
        language: 'Go',
        topics: ['backend'],
      }),
    },
    {
      repoId: 'r-unrelated',
      repo: makeRepo({
        fullName: 'org/unrelated',
        language: 'Python',
        topics: ['ai', 'vision'],
      }),
    },
  ];

  const memories: Map<string, Memory> = new Map([
    [
      'anchor',
      {
        repoId: 'anchor',
        source: 'github_star',
        sourceCreatedAt: null,
        whySaved: '团队统一检索方案',
        note: null,
      },
    ],
    [
      'r-memory',
      {
        repoId: 'r-memory',
        source: 'github_star',
        sourceCreatedAt: null,
        whySaved: '后端检索服务框架',
        note: null,
      },
    ],
  ]);

  it('ranks neighbors by topic overlap, language match, and memory intent overlap', () => {
    const results = findKeywordFallbackNeighbors({
      anchorRepoId: 'anchor',
      anchorRepo,
      items,
      memoriesByRepoId: memories,
      limit: 5,
    });

    // r-topic has 2 topic overlaps (4.0 score)
    // r-memory has memory keyword overlap '检索' (2.5 score)
    // r-lang has language match (1.0 score)
    // r-unrelated has 0 score and is filtered out
    expect(results.map((r) => r.repoId)).toEqual(['r-topic', 'r-memory', 'r-lang']);
    expect(results[0]?.matchedReason).toBe('topic');
    expect(results[1]?.matchedReason).toBe('memory');
    expect(results[2]?.matchedReason).toBe('language');
  });

  it('filters out anchor repo itself from fallback results', () => {
    const itemsWithAnchor = [
      ...items,
      {
        repoId: 'anchor',
        repo: anchorRepo,
      },
    ];

    const results = findKeywordFallbackNeighbors({
      anchorRepoId: 'anchor',
      anchorRepo,
      items: itemsWithAnchor,
      memoriesByRepoId: memories,
    });

    expect(results.some((r) => r.repoId === 'anchor')).toBe(false);
  });
});
