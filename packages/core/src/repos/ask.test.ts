import { describe, expect, it } from 'vitest';
import type { Memory } from '../models/memory';
import type { Repo } from '../models/repo';
import {
  ASK_MAX_RECOMMENDATIONS,
  ASK_PROVIDERS,
  type AskCandidate,
  buildAskFixedPrompt,
  buildAskPrompt,
  findAskProvider,
  parseAskFixedResponse,
  parseAskResponse,
  readAskGenerationMode,
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
  it('embeds the catalog in system and keeps history available', () => {
    const prompt = buildAskPrompt({
      question: 'Which Rust libraries support WebSocket?',
      catalog:
        'Collection catalog (full, 1 repositories):\nrepo-ws | rustws/tungstenite | Rust | websocket',
      history: [{ question: 'websocket libs?', summary: 'Suggested rustws/tungstenite.' }],
      language: 'zh-CN',
    });
    expect(prompt.system).toContain('MUST call expand');
    expect(prompt.system).toContain('Write the summary in this language: zh-CN');
    expect(prompt.system).toContain('repo-ws | rustws/tungstenite');
    expect(prompt.user).toContain('Question: Which Rust libraries support WebSocket?');
    expect(prompt.user).toContain('Q: websocket libs?');
    expect(prompt.user).toContain('those repositories remain available');
  });

  it('notes when memory notes are disabled', () => {
    const prompt = buildAskPrompt({
      question: 'any',
      catalog: 'Collection catalog (full, 0 repositories):',
      includeNotes: false,
    });
    expect(prompt.system).toContain('disabled sending Memory notes');
  });
});

describe('buildAskFixedPrompt', () => {
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
    const prompt = buildAskFixedPrompt({
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
    const prompt = buildAskFixedPrompt({
      question: 'which of those is lighter?',
      candidates,
      history: [{ question: 'websocket libs?', summary: 'Suggested [0].' }],
    });
    expect(prompt.user).toContain('Q: websocket libs?');
    expect(prompt.user).toContain('A: Suggested [0].');
    expect(prompt.user).toContain('context only');
  });

  it('omits memory notes when includeNotes is false but keeps metadata', () => {
    const prompt = buildAskFixedPrompt({
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
      tools: false,
      longContext: false,
      mode: 'fixed',
    });
    expect(readTestedModel(capability)).toBe('deepseek-chat');
    expect(readAskGenerationMode(capability)).toBe('fixed');
    expect(
      readAskGenerationMode({
        ok: true,
        model: 'deepseek-chat',
        testedAt: 'now',
        reason: null,
        tools: true,
        longContext: true,
      }),
    ).toBe('agent');
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
  function answer(summary: string, recommendations: string): string {
    return `${summary}\n\n\`\`\`asterism-recommendations\n${recommendations}\n\`\`\``;
  }

  it('parses markdown prose and keeps only expanded repoIds', () => {
    const result = parseAskResponse(answer('axum fits best.', '["axum", "ghost", "axum"]'), [
      'axum',
    ]);
    expect(result).toEqual({
      ok: true,
      answer: {
        summary: 'axum fits best.',
        recommendations: [{ repoId: 'axum', index: null }],
      },
    });
  });

  it('treats a missing sentinel as an empty recommendation list', () => {
    const result = parseAskResponse('Sure.', ['axum']);
    expect(result).toEqual({
      ok: true,
      answer: { summary: 'Sure.', recommendations: [] },
    });
  });

  it('drops indexes and unexpanded ids, then truncates to the hard cap', () => {
    const ids = Array.from({ length: 10 }, (_, index) => `repo-${index}`);
    const result = parseAskResponse(answer('s', JSON.stringify([...ids, 0])), ids);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.answer.recommendations).toHaveLength(ASK_MAX_RECOMMENDATIONS);
      expect(result.answer.recommendations[0]).toEqual({ repoId: 'repo-0', index: null });
    }
  });

  it('rejects empty summaries', () => {
    expect(parseAskResponse('```asterism-recommendations\n["axum"]\n```', ['axum'])).toEqual({
      ok: false,
      error: 'empty_summary',
    });
  });
});

describe('parseAskFixedResponse', () => {
  const candidates: AskCandidate[] = [
    { item: item({}, 'repo-a'), repoId: 'repo-a', lexicalScore: 3, reasons: [] },
    { item: item({}, 'repo-b'), repoId: 'repo-b', lexicalScore: 2, reasons: [] },
  ];

  it('maps candidate indexes to repoIds', () => {
    const result = parseAskFixedResponse(
      'fits.\n\n```asterism-recommendations\n[0, 1, 0, 99]\n```',
      candidates,
    );
    expect(result).toEqual({
      ok: true,
      answer: {
        summary: 'fits.',
        recommendations: [
          { index: 0, repoId: 'repo-a' },
          { index: 1, repoId: 'repo-b' },
        ],
      },
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
