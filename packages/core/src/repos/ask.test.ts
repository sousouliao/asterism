import { describe, expect, it } from 'vitest';
import type { Memory } from '../models/memory';
import type { Repo } from '../models/repo';
import {
  ASK_MAX_RECOMMENDATIONS,
  ASK_PROVIDERS,
  type AskCandidate,
  buildAskPrompt,
  findAskProvider,
  parseAskResponse,
  readGenerationCapability,
  readTestedModel,
  selectAskCandidates,
  tokenizeQuestion,
} from './ask';
import type { StarredRepoLike } from './filter';

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

function item(overrides: Partial<Repo>, repoId: string): StarredRepoLike {
  return { repo: makeRepo(overrides), starredAt: '2025-01-01T00:00:00Z', repoId };
}

function memory(
  repoId: string,
  fields: { whySaved?: string | null; note?: string | null },
): Memory {
  return {
    repoId,
    source: 'github_star',
    sourceCreatedAt: null,
    whySaved: fields.whySaved ?? null,
    note: fields.note ?? null,
  };
}

describe('tokenizeQuestion', () => {
  it('keeps meaningful latin terms and drops glue words', () => {
    expect(tokenizeQuestion('Which Rust libraries support WebSocket?')).toEqual(
      expect.arrayContaining(['rust', 'libraries', 'support', 'websocket']),
    );
    expect(tokenizeQuestion('Which Rust libraries support WebSocket?')).not.toContain('which');
  });

  it('preserves technical spellings like c++', () => {
    expect(tokenizeQuestion('lightweight c++ parsing tools')).toContain('c++');
  });

  it('splits chinese runs into bigrams and drops glue words', () => {
    const terms = tokenizeQuestion('我存过哪些做虚拟滚动的库');
    expect(terms).toEqual(expect.arrayContaining(['虚拟', '拟滚', '滚动']));
    expect(terms).not.toContain('哪些');
  });

  it('returns no terms for a stopword-only question', () => {
    expect(tokenizeQuestion('the of and')).toEqual([]);
  });
});

describe('selectAskCandidates', () => {
  const websocket = item(
    {
      fullName: 'rustws/tokio-tungstenite',
      name: 'tokio-tungstenite',
      description: 'Lightweight WebSocket implementation for Tokio',
      language: 'Rust',
      topics: ['websocket', 'network'],
      stargazers: 1200,
    },
    'repo-ws',
  );
  const virtualScroll = item(
    {
      fullName: 'ui/virtua',
      name: 'virtua',
      description: 'A virtual scroll library',
      stargazers: 800,
    },
    'repo-vs',
  );
  const unrelated = item(
    {
      fullName: 'other/unrelated',
      name: 'unrelated',
      description: 'A parser toolkit',
      stargazers: 50,
    },
    'repo-un',
  );

  it('recalls by lexical terms and drops non-matching items', () => {
    const candidates = selectAskCandidates({
      question: 'websocket rust library',
      items: [websocket, virtualScroll, unrelated],
    });
    expect(candidates.map((candidate) => candidate.repoId)).toEqual(['repo-ws', 'repo-vs']);
  });

  it('weights personal memory above objective metadata', () => {
    const noted = item(
      { fullName: 'a/quiet-tool', name: 'quiet-tool', description: null, stargazers: 10 },
      'repo-noted',
    );
    const candidates = selectAskCandidates({
      question: 'virtual scroll',
      items: [noted, virtualScroll],
      memoriesByRepoId: new Map([
        ['repo-noted', memory('repo-noted', { whySaved: 'for virtual scroll rendering' })],
      ]),
    });
    expect(candidates[0]?.repoId).toBe('repo-noted');
    expect(candidates[0]?.lexicalScore).toBe(10);
    expect(candidates[1]?.repoId).toBe('repo-vs');
  });

  it('records ordered evidence reasons with personal memory first', () => {
    const candidates = selectAskCandidates({
      question: 'websocket push',
      items: [websocket],
      memoriesByRepoId: new Map([
        ['repo-ws', memory('repo-ws', { note: 'used for websocket push' })],
      ]),
    });
    const kinds = candidates[0]?.reasons.map((reason) => reason.kind);
    expect(kinds?.[0]).toBe('note');
    expect(kinds).toEqual(expect.arrayContaining(['note', 'description']));
    expect(candidates[0]?.reasons[0]?.snippet).toContain('websocket push');
  });

  it('orders ties deterministically by stargazers then fullName', () => {
    const left = item(
      { fullName: 'a/left', name: 'left', description: 'websocket server', stargazers: 90 },
      'repo-a',
    );
    const right = item(
      { fullName: 'b/right', name: 'right', description: 'websocket server', stargazers: 90 },
      'repo-b',
    );
    const candidates = selectAskCandidates({
      question: 'websocket',
      items: [right, left],
    });
    expect(candidates.map((candidate) => candidate.repoId)).toEqual(['repo-a', 'repo-b']);
  });

  it('appends unmatched semantic neighbors after lexical matches, ordered by distance', () => {
    const candidates = selectAskCandidates({
      question: 'websocket',
      items: [websocket, virtualScroll, unrelated],
      distanceByRepoId: new Map([
        ['repo-un', 0.9],
        ['repo-vs', 0.4],
      ]),
    });
    expect(candidates.map((candidate) => candidate.repoId)).toEqual([
      'repo-ws',
      'repo-vs',
      'repo-un',
    ]);
    expect(candidates[1]?.lexicalScore).toBeNull();
    expect(candidates[1]?.semanticDistance).toBe(0.4);
  });

  it('respects the limit across lexical and semantic pools', () => {
    const many = Array.from({ length: 20 }, (_, index) =>
      item(
        {
          fullName: `owner/tool-${index}`,
          name: `tool-${index}`,
          description: 'websocket toolkit',
          stargazers: index,
        },
        `repo-${index}`,
      ),
    );
    const candidates = selectAskCandidates({ question: 'websocket', items: many, limit: 5 });
    expect(candidates).toHaveLength(5);
  });

  it('skips items without a repoId and returns empty for an empty question', () => {
    const floating = { repo: makeRepo({ description: 'websocket' }), starredAt: null };
    expect(
      selectAskCandidates({ question: 'websocket', items: [floating as StarredRepoLike] }),
    ).toEqual([]);
    expect(selectAskCandidates({ question: '', items: [websocket] })).toEqual([]);
  });
});

describe('buildAskPrompt', () => {
  const candidates: AskCandidate[] = [
    {
      item: item(
        {
          fullName: 'rustws/tokio-tungstenite',
          name: 'tokio-tungstenite',
          description: 'Lightweight WebSocket implementation for Tokio',
          language: 'Rust',
          topics: ['websocket'],
          stargazers: 1200,
        },
        'repo-ws',
      ),
      repoId: 'repo-ws',
      lexicalScore: 9,
      reasons: [{ kind: 'description', snippet: 'Lightweight WebSocket…' }],
    },
    {
      item: item({ fullName: 'ui/virtua', name: 'virtua' }, 'repo-vs'),
      repoId: 'repo-vs',
      lexicalScore: null,
      semanticDistance: 0.4,
      reasons: [{ kind: 'semantic_repo' }],
    },
  ];

  it('embeds question, indexed metadata and personal memory text', () => {
    const prompt = buildAskPrompt({
      question: 'Which Rust libraries support WebSocket?',
      candidates,
      memoriesByRepoId: new Map([['repo-ws', memory('repo-ws', { note: 'used for push' })]]),
      language: 'zh-CN',
    });
    expect(prompt.system).toContain('strictly from the numbered repository candidates');
    expect(prompt.system).toContain('Write the summary in this language: zh-CN');
    expect(prompt.user).toContain('Question: Which Rust libraries support WebSocket?');
    expect(prompt.user).toContain('[0] rustws/tokio-tungstenite');
    expect(prompt.user).toContain('Language: Rust');
    expect(prompt.user).toContain("Note (user's own note): used for push");
    expect(prompt.user).toContain('[1] ui/virtua — No description');
    expect(prompt.user).not.toContain("Why saved (user's own note):");
  });

  it('includes prior turns as context only', () => {
    const prompt = buildAskPrompt({
      question: 'which of those is lighter?',
      candidates,
      history: [{ question: 'websocket libs?', summary: 'Suggested [0].' }],
    });
    expect(prompt.user).toContain('Q: websocket libs?');
    expect(prompt.user).toContain('A: Suggested [0].');
    expect(prompt.user).toContain('context only');
  });

  it('omits memory notes when includeNotes is false but keeps metadata', () => {
    const prompt = buildAskPrompt({
      question: 'Which Rust libraries support WebSocket?',
      candidates,
      memoriesByRepoId: new Map([
        [
          'repo-ws',
          memory('repo-ws', { whySaved: 'streaming experiments', note: 'used for push' }),
        ],
      ]),
      includeNotes: false,
    });
    expect(prompt.user).toContain('[0] rustws/tokio-tungstenite');
    expect(prompt.user).toContain('Language: Rust');
    expect(prompt.user).not.toContain("Why saved (user's own note):");
    expect(prompt.user).not.toContain("Note (user's own note):");
  });
});

describe('connection capability readers', () => {
  it('projects a stored probe result and its tested model', () => {
    const capability = {
      ok: true,
      reason: null,
      model: 'deepseek-chat',
      testedAt: '2026-09-20T00:00:00.000Z',
    };
    expect(readGenerationCapability(capability)).toEqual({
      ok: true,
      model: 'deepseek-chat',
      testedAt: '2026-09-20T00:00:00.000Z',
      reason: null,
    });
    expect(readTestedModel(capability)).toBe('deepseek-chat');
  });

  it('returns no tested model for failed probes and rejects malformed records', () => {
    const failed = { ok: false, reason: 'unauthorized', model: 'deepseek-chat', testedAt: null };
    expect(readTestedModel(failed)).toBeNull();
    expect(readGenerationCapability(failed)?.reason).toBe('unauthorized');
    expect(readGenerationCapability(null)).toBeNull();
    expect(readGenerationCapability({ ok: 'yes' })).toBeNull();
  });
});

describe('parseAskResponse', () => {
  const candidates: AskCandidate[] = [
    { item: item({}, 'repo-a'), repoId: 'repo-a', lexicalScore: 3, reasons: [] },
    { item: item({}, 'repo-b'), repoId: 'repo-b', lexicalScore: 2, reasons: [] },
  ];

  function answer(summary: string, recommendations: string): string {
    return `${summary}\n\n\`\`\`asterism-recommendations\n${recommendations}\n\`\`\``;
  }

  it('parses markdown prose and maps indexes to repoIds', () => {
    const result = parseAskResponse(answer('[0] fits best.', '[0, 1]'), candidates);
    expect(result).toEqual({
      ok: true,
      answer: {
        summary: '[0] fits best.',
        recommendations: [
          { index: 0, repoId: 'repo-a' },
          { index: 1, repoId: 'repo-b' },
        ],
      },
    });
  });

  it('treats a missing sentinel as an empty recommendation list', () => {
    const result = parseAskResponse('Sure.', candidates);
    expect(result).toEqual({
      ok: true,
      answer: { summary: 'Sure.', recommendations: [] },
    });
  });

  it('drops out-of-range, non-integer and duplicate indexes', () => {
    const result = parseAskResponse(answer('s', '[0, -1, 2, 1.5, 0, 99]'), candidates);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.answer.recommendations).toEqual([{ index: 0, repoId: 'repo-a' }]);
    }
  });

  it('truncates recommendations to the hard cap', () => {
    const pool = Array.from({ length: 10 }, (_, index) => ({
      item: item({}, `repo-${index}`),
      repoId: `repo-${index}`,
      lexicalScore: 1,
      reasons: [],
    })) as AskCandidate[];
    const result = parseAskResponse(answer('s', '[0,1,2,3,4,5,6,7,8,9]'), pool);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.answer.recommendations).toHaveLength(ASK_MAX_RECOMMENDATIONS);
    }
  });

  it('accepts an empty recommendation list as an honest no-match', () => {
    const result = parseAskResponse(answer('No match found.', '[]'), candidates);
    expect(result).toEqual({
      ok: true,
      answer: { summary: 'No match found.', recommendations: [] },
    });
  });

  it('rejects empty summaries', () => {
    expect(parseAskResponse('```asterism-recommendations\n[0]\n```', candidates)).toEqual({
      ok: false,
      error: 'empty_summary',
    });
    expect(parseAskResponse('   \n', candidates)).toEqual({
      ok: false,
      error: 'empty_summary',
    });
  });
});

describe('ask provider registry', () => {
  it('exposes the ADR 0042 allowlist with fixed base URLs', () => {
    expect(ASK_PROVIDERS.map((provider) => provider.id)).toEqual([
      'deepseek',
      'openai',
      'groq',
      'openrouter',
    ]);
    for (const provider of ASK_PROVIDERS) {
      expect(provider.baseUrl.startsWith('https://')).toBe(true);
      expect(provider.defaultModel.length).toBeGreaterThan(0);
    }
  });

  it('finds providers by id and rejects unknown ids', () => {
    expect(findAskProvider('deepseek')?.baseUrl).toBe('https://api.deepseek.com');
    expect(findAskProvider('custom')).toBeUndefined();
  });
});
