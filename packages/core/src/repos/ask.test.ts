import { describe, expect, it } from 'vitest';
import {
  ASK_MAX_RECOMMENDATIONS,
  ASK_PROVIDERS,
  buildAskPrompt,
  findAskProvider,
  parseAskResponse,
  readGenerationCapability,
  readTestedModel,
  tokenizeQuestion,
} from './ask';

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

  it('ignores capability fields left over from the retired capability grading', () => {
    expect(
      readGenerationCapability({
        ok: true,
        model: 'deepseek-chat',
        testedAt: 'now',
        reason: null,
        tools: false,
        longContext: false,
        mode: 'fixed',
      }),
    ).toEqual({ ok: true, model: 'deepseek-chat', testedAt: 'now', reason: null });
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
      answer: { summary: 'axum fits best.', recommendations: [{ repoId: 'axum' }] },
    });
  });

  it('treats a missing sentinel as an empty recommendation list', () => {
    const result = parseAskResponse('Sure.', ['axum']);
    expect(result).toEqual({
      ok: true,
      answer: { summary: 'Sure.', recommendations: [] },
    });
  });

  it('keeps prose usable when the model never called a tool', () => {
    expect(parseAskResponse('I looked at your catalog and nothing matches.', [])).toEqual({
      ok: true,
      answer: {
        summary: 'I looked at your catalog and nothing matches.',
        recommendations: [],
      },
    });
  });

  it('drops indexes and unexpanded ids, then truncates to the hard cap', () => {
    const ids = Array.from({ length: 10 }, (_, index) => `repo-${index}`);
    const result = parseAskResponse(answer('s', JSON.stringify([...ids, 0])), ids);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.answer.recommendations).toHaveLength(ASK_MAX_RECOMMENDATIONS);
      expect(result.answer.recommendations[0]).toEqual({ repoId: 'repo-0' });
    }
  });

  it('rejects empty summaries', () => {
    expect(parseAskResponse('```asterism-recommendations\n["axum"]\n```', ['axum'])).toEqual({
      ok: false,
      error: 'empty_summary',
    });
  });
});

describe('ask provider registry', () => {
  it('exposes the ADR 0042 allowlist with fixed base URLs', () => {
    expect(ASK_PROVIDERS.map((provider) => provider.id)).toEqual(['openai', 'deepseek']);
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
