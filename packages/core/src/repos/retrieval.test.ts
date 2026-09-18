import { describe, expect, it } from 'vitest';
import type { Memory } from '../models/memory';
import type { Repo } from '../models/repo';
import type { StarredRepoLike } from './filter';
import { extractSnippet, retrieveRepos } from './retrieval';

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

function item(
  overrides: Partial<Repo>,
  repoId: string,
  starredAt: string | null = null,
): StarredRepoLike {
  return { repo: makeRepo(overrides), starredAt, repoId };
}

const NOW = Date.parse('2026-06-30T00:00:00Z');

const dataset: StarredRepoLike[] = [
  item(
    {
      githubId: 1,
      fullName: 'traefik/traefik',
      name: 'traefik',
      owner: 'traefik',
      description: 'The Cloud Native Application Proxy',
      stargazers: 50000,
      language: 'Go',
      topics: ['proxy', 'docker', 'ingress'],
    },
    'r1',
  ),
  item(
    {
      githubId: 2,
      fullName: 'envoyproxy/envoy',
      name: 'envoy',
      owner: 'envoyproxy',
      description: 'Cloud-native high-performance edge/middle/service proxy',
      stargazers: 30000,
      language: 'C++',
      topics: ['c-plus-plus', 'proxy'],
    },
    'r2',
  ),
  item(
    {
      githubId: 3,
      fullName: 'my-org/custom-tool',
      name: 'custom-tool',
      owner: 'my-org',
      description: 'Internal utility without keywords',
      stargazers: 10,
      language: 'Rust',
      topics: ['tools'],
    },
    'r3',
  ),
  item(
    {
      githubId: 4,
      fullName: 'redis/go-redis',
      name: 'go-redis',
      owner: 'redis',
      description: 'Redis client for Golang',
      stargazers: 20000,
      language: 'Go',
      topics: ['redis', 'database'],
    },
    'r4',
  ),
];

const sampleMemories: Map<string, Memory> = new Map([
  [
    'r3',
    {
      repoId: 'r3',
      source: 'github_star',
      sourceCreatedAt: '2026-01-01T00:00:00Z',
      whySaved: '用作旧项目网关替换的备选方案',
      note: '带连接池配置，性能表现优异',
    },
  ],
  [
    'r4',
    {
      repoId: 'r4',
      source: 'github_star',
      sourceCreatedAt: '2026-01-01T00:00:00Z',
      whySaved: 'Go 客户端连接池实现参考',
      note: null,
    },
  ],
]);

describe('extractSnippet', () => {
  it('extracts snippet containing the matched query with surrounding context', () => {
    const text = '这是我们团队用来替换旧项目微服务网关的核心组件库';
    const snippet = extractSnippet(text, '网关', 20);
    expect(snippet).toContain('网关');
  });

  it('adds ellipsis when text exceeds length', () => {
    const text = `${'A'.repeat(50)}TARGET${'B'.repeat(50)}`;
    const snippet = extractSnippet(text, 'TARGET', 30);
    expect(snippet.startsWith('...')).toBe(true);
    expect(snippet.endsWith('...')).toBe(true);
    expect(snippet).toContain('TARGET');
  });

  it('returns full trimmed text if shorter than max length', () => {
    expect(extractSnippet('hello world', 'world', 50)).toBe('hello world');
  });
});

describe('retrieveRepos', () => {
  it('with empty query returns full sorted list and empty explanations', () => {
    const result = retrieveRepos({
      items: dataset,
      filter: {},
      sort: 'stars',
      now: NOW,
    });
    expect(result.primary.map((r) => r.repoId)).toEqual(['r1', 'r2', 'r4', 'r3']);
    expect(result.semantic).toEqual([]);
    expect(result.explanations.size).toBe(0);
  });

  it('matches repositories by objective metadata (name, description, topics)', () => {
    const result = retrieveRepos({
      items: dataset,
      filter: { query: 'ingress' },
      sort: 'stars',
      now: NOW,
    });
    expect(result.primary.map((r) => r.repoId)).toEqual(['r1']);
    const explanation = result.explanations.get('r1');
    expect(explanation).toBeDefined();
    expect(explanation?.primaryReason.kind).toBe('topic');
    expect(explanation?.primaryReason.snippet).toBe('ingress');
  });

  it('matches repositories by subjective whySaved in Memory and prioritizes it', () => {
    // '网关' only exists in r3's whySaved
    const result = retrieveRepos({
      items: dataset,
      filter: { query: '网关' },
      sort: 'stars',
      now: NOW,
      memoriesByRepoId: sampleMemories,
    });
    expect(result.primary.map((r) => r.repoId)).toEqual(['r3']);
    const explanation = result.explanations.get('r3');
    expect(explanation).toBeDefined();
    expect(explanation?.primaryReason.kind).toBe('why_saved');
    expect(explanation?.primaryReason.snippet).toContain('网关');
  });

  it('matches repositories by subjective note in Memory', () => {
    // '连接池配置' only exists in r3's note
    const result = retrieveRepos({
      items: dataset,
      filter: { query: '连接池配置' },
      sort: 'stars',
      now: NOW,
      memoriesByRepoId: sampleMemories,
    });
    expect(result.primary.map((r) => r.repoId)).toEqual(['r3']);
    const explanation = result.explanations.get('r3');
    expect(explanation).toBeDefined();
    expect(explanation?.primaryReason.kind).toBe('note');
    expect(explanation?.primaryReason.snippet).toContain('连接池');
  });

  it('prefers why_saved over name and description when multiple fields match', () => {
    const customWithProxy = item(
      {
        githubId: 99,
        fullName: 'my/proxy-project',
        description: 'A proxy project',
      },
      'r99',
    );
    const memories = new Map([
      [
        'r99',
        {
          repoId: 'r99',
          source: 'github_star' as const,
          sourceCreatedAt: null,
          whySaved: 'proxy for internal service',
          note: null,
        },
      ],
    ]);

    const result = retrieveRepos({
      items: [customWithProxy],
      filter: { query: 'proxy' },
      sort: 'name',
      now: NOW,
      memoriesByRepoId: memories,
    });
    const explanation = result.explanations.get('r99');
    expect(explanation?.primaryReason.kind).toBe('why_saved');
    expect(explanation?.reasons.map((r) => r.kind)).toContain('name');
    expect(explanation?.reasons.map((r) => r.kind)).toContain('description');
  });

  it('ranks personal-intent matches before objective metadata matches', () => {
    const metadataMatch = item(
      {
        githubId: 98,
        fullName: 'popular/proxy',
        name: 'proxy',
        description: 'A popular proxy',
        stargazers: 100_000,
      },
      'r98',
    );
    const intentMatch = item(
      {
        githubId: 99,
        fullName: 'small/tool',
        name: 'tool',
        description: 'An internal utility',
        stargazers: 1,
      },
      'r99',
    );
    const memories = new Map([
      [
        'r99',
        {
          repoId: 'r99',
          source: 'github_star' as const,
          sourceCreatedAt: null,
          whySaved: 'proxy replacement for our gateway',
          note: null,
        },
      ],
    ]);

    const result = retrieveRepos({
      items: [metadataMatch, intentMatch],
      filter: { query: 'proxy' },
      sort: 'stars',
      memoriesByRepoId: memories,
    });

    expect(result.primary.map((entry) => entry.repoId)).toEqual(['r99', 'r98']);
  });

  it('smoothly degrades to keyword search when distance map is absent or empty', () => {
    const result = retrieveRepos({
      items: dataset,
      filter: { query: 'proxy' },
      sort: 'stars',
      now: NOW,
      distanceByRepoId: undefined,
    });
    expect(result.primary.map((r) => r.repoId)).toEqual(['r2', 'r1']);
    expect(result.semantic).toEqual([]);
  });

  it('recommends semantic neighbors with neutral explanations when field attribution is unknown', () => {
    // Query 'application proxy' matches r1 in keyword
    // r3 has personal memory and is in distance map
    // r4 has no matching keyword, is in distance map
    const distanceMap = new Map([
      ['r3', 0.15],
      ['r4', 0.25],
    ]);

    const result = retrieveRepos({
      items: dataset,
      filter: { query: 'Application Proxy' },
      sort: 'stars',
      now: NOW,
      memoriesByRepoId: sampleMemories,
      distanceByRepoId: distanceMap,
    });

    expect(result.primary.map((r) => r.repoId)).toEqual(['r1']);
    expect(result.semantic.map((r) => r.repoId)).toEqual(['r3', 'r4']);

    // A combined vector cannot prove whether similarity came from Memory or repository metadata.
    const r3Exp = result.explanations.get('r3');
    expect(r3Exp?.primaryReason.kind).toBe('semantic_repo');

    const r4Exp = result.explanations.get('r4');
    expect(r4Exp?.primaryReason.kind).toBe('semantic_repo');

    // test repo without memory
    const datasetWithNoMemoryRepo = [
      ...dataset,
      item({ githubId: 5, fullName: 'no/memory', description: 'desc' }, 'r5'),
    ];
    const distanceWithR5 = new Map([['r5', 0.1]]);
    const res2 = retrieveRepos({
      items: datasetWithNoMemoryRepo,
      filter: { query: 'Application Proxy' },
      sort: 'stars',
      now: NOW,
      memoriesByRepoId: sampleMemories,
      distanceByRepoId: distanceWithR5,
    });
    expect(res2.explanations.get('r5')?.primaryReason.kind).toBe('semantic_repo');
  });

  it('respects facet filters on both primary matches and semantic neighbors', () => {
    const distanceMap = new Map([
      ['r2', 0.1], // C++
      ['r4', 0.2], // Go
    ]);

    const result = retrieveRepos({
      items: dataset,
      filter: { query: 'proxy', language: 'Go' },
      sort: 'stars',
      now: NOW,
      memoriesByRepoId: sampleMemories,
      distanceByRepoId: distanceMap,
    });

    // Primary: only r1 is Go and matches proxy (r2 is C++)
    expect(result.primary.map((r) => r.repoId)).toEqual(['r1']);
    // Semantic: r2 is filtered out by language: Go, only r4 remains
    expect(result.semantic.map((r) => r.repoId)).toEqual(['r4']);
  });
});
