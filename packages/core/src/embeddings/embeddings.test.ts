import { describe, expect, it } from 'vitest';
import {
  computeContentHash,
  DEFAULT_EMBEDDING_DIMENSIONS,
  DEFAULT_EMBEDDING_MODEL,
  E5_PASSAGE_PREFIX,
  E5_QUERY_PREFIX,
  EMBEDDING_BACKFILL_BATCH_SIZE,
  embeddableRepoText,
  repoContentHash,
  runEmbeddingBackfill,
  selectReposToEmbed,
  toPassageInput,
  toQueryInput,
} from './embeddings';

describe('default embedding model', () => {
  it('pins the versionable model id and its dimension', () => {
    expect(DEFAULT_EMBEDDING_MODEL).toBe('multilingual-e5-small');
    expect(DEFAULT_EMBEDDING_DIMENSIONS).toBe(384);
  });
});

describe('embeddableRepoText', () => {
  it('joins full name, description and topics in a stable order', () => {
    const text = embeddableRepoText({
      fullName: 'owner/name',
      description: 'A tiny library',
      topics: ['cli', 'rust'],
    });
    expect(text).toBe('owner/name\nA tiny library\ncli rust');
  });

  it('omits missing description and empty topics without leaving blank segments', () => {
    expect(embeddableRepoText({ fullName: 'owner/name', description: null, topics: [] })).toBe(
      'owner/name',
    );
    expect(embeddableRepoText({ fullName: 'owner/name', description: '   ', topics: ['  '] })).toBe(
      'owner/name',
    );
  });

  it('trims surrounding whitespace so cosmetic changes do not alter the text', () => {
    expect(
      embeddableRepoText({
        fullName: '  owner/name  ',
        description: '  hi  ',
        topics: [' a ', 'b'],
      }),
    ).toBe('owner/name\nhi\na b');
  });

  it('incorporates whySaved and note when provided', () => {
    const text = embeddableRepoText({
      fullName: 'owner/name',
      description: 'desc',
      topics: ['topic'],
      whySaved: 'Replacing our legacy gateway',
      note: 'Need to benchmark performance with pool',
    });
    expect(text).toBe(
      'owner/name\ndesc\ntopic\nReplacing our legacy gateway\nNeed to benchmark performance with pool',
    );
  });

  it('omits empty or whitespace-only whySaved and note', () => {
    const text = embeddableRepoText({
      fullName: 'owner/name',
      description: 'desc',
      topics: [],
      whySaved: '   ',
      note: null,
    });
    expect(text).toBe('owner/name\ndesc');
  });
});

describe('computeContentHash', () => {
  it('is deterministic for the same input', () => {
    expect(computeContentHash('owner/name\nhi')).toBe(computeContentHash('owner/name\nhi'));
  });

  it('changes when the embedded text changes', () => {
    expect(computeContentHash('owner/name\nhi')).not.toBe(computeContentHash('owner/name\nhey'));
  });

  it('produces a fixed-length hex digest, including for multilingual text', () => {
    expect(computeContentHash('语义搜索 · semantic search')).toMatch(/^[0-9a-f]{16}$/);
    expect(computeContentHash('')).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('repoContentHash', () => {
  it('equals hashing the assembled embeddable text', () => {
    const repo = { fullName: 'owner/name', description: 'desc', topics: ['x'] };
    expect(repoContentHash(repo)).toBe(computeContentHash(embeddableRepoText(repo)));
  });
});

describe('e5 instruction prefixes', () => {
  it('pins the passage / query prefixes', () => {
    expect(E5_PASSAGE_PREFIX).toBe('passage: ');
    expect(E5_QUERY_PREFIX).toBe('query: ');
  });
});

describe('toPassageInput', () => {
  it('prefixes the assembled embeddable text with passage:', () => {
    const repo = { fullName: 'owner/name', description: 'desc', topics: ['x'] };
    expect(toPassageInput(repo)).toBe(`passage: ${embeddableRepoText(repo)}`);
  });

  it('keeps the prefix outside the hashed text so it never triggers a re-embed', () => {
    const repo = { fullName: 'owner/name', description: 'desc', topics: ['x'] };
    expect(toPassageInput(repo).endsWith(embeddableRepoText(repo))).toBe(true);
    expect(repoContentHash(repo)).toBe(computeContentHash(embeddableRepoText(repo)));
  });
});

describe('toQueryInput', () => {
  it('prefixes a query with query: and trims surrounding whitespace', () => {
    expect(toQueryInput('  rust cli  ')).toBe('query: rust cli');
  });

  it('shares the prefix scheme with passage assembly but a different instruction', () => {
    expect(toQueryInput('x')).toBe(`${E5_QUERY_PREFIX}x`);
    expect(toPassageInput({ fullName: 'x', description: null, topics: [] })).toBe(
      `${E5_PASSAGE_PREFIX}x`,
    );
  });
});

describe('runEmbeddingBackfill', () => {
  const target = (index: number) => ({
    repoId: `repo-${index}`,
    contentHash: `hash-${index}`,
    input: `passage: repo-${index}`,
  });

  it('embeds resumable targets in bounded 16-item chunks and persists each completed row', async () => {
    const embeddedBatches: string[][] = [];
    const persisted: string[] = [];
    const progress: Array<{ completed: number; total: number }> = [];
    const targets = Array.from({ length: 18 }, (_, index) => target(index));

    const result = await runEmbeddingBackfill({
      targets,
      embedBatch: async (inputs) => {
        embeddedBatches.push([...inputs]);
        return inputs.map(() => Array.from({ length: DEFAULT_EMBEDDING_DIMENSIONS }, () => 0.25));
      },
      persist: async (item) => {
        persisted.push(item.repoId);
      },
      onProgress: (value) => progress.push(value),
    });

    expect(EMBEDDING_BACKFILL_BATCH_SIZE).toBe(16);
    expect(embeddedBatches.map((batch) => batch.length)).toEqual([16, 2]);
    expect(persisted).toEqual(targets.map((item) => item.repoId));
    expect(progress.at(-1)).toEqual({ completed: 18, total: 18 });
    expect(result).toEqual({ completed: 18, total: 18 });
  });

  it('is a near no-op when every repository is already fresh', async () => {
    let embedCalls = 0;
    let persistCalls = 0;

    const result = await runEmbeddingBackfill({
      targets: [],
      embedBatch: async () => {
        embedCalls += 1;
        return [];
      },
      persist: async () => {
        persistCalls += 1;
      },
    });

    expect(result).toEqual({ completed: 0, total: 0 });
    expect(embedCalls).toBe(0);
    expect(persistCalls).toBe(0);
  });

  it('keeps completed rows durable when a later row fails so the next pending query can resume', async () => {
    const persisted: string[] = [];

    await expect(
      runEmbeddingBackfill({
        targets: [target(0), target(1), target(2)],
        embedBatch: async (inputs) =>
          inputs.map(() => Array.from({ length: DEFAULT_EMBEDDING_DIMENSIONS }, () => 0.25)),
        persist: async (item) => {
          if (item.repoId === 'repo-2') {
            throw new Error('temporary write failure');
          }
          persisted.push(item.repoId);
        },
      }),
    ).rejects.toThrow('temporary write failure');

    expect(persisted).toEqual(['repo-0', 'repo-1']);
  });

  it('rejects malformed model output before writing it', async () => {
    let persistCalls = 0;

    await expect(
      runEmbeddingBackfill({
        targets: [target(0)],
        embedBatch: async () => [[0.1, 0.2]],
        persist: async () => {
          persistCalls += 1;
        },
      }),
    ).rejects.toThrow('Expected a 384-dimensional embedding');

    expect(persistCalls).toBe(0);
  });
});

describe('selectReposToEmbed', () => {
  const model = DEFAULT_EMBEDDING_MODEL;

  it('marks repos with no stored row as missing', () => {
    const result = selectReposToEmbed({
      model,
      desired: [{ repoId: 'r1', contentHash: 'h1' }],
      stored: [],
    });
    expect(result).toEqual([{ repoId: 'r1', reason: 'missing' }]);
  });

  it('marks repos whose stored model differs from the current model', () => {
    const result = selectReposToEmbed({
      model,
      desired: [{ repoId: 'r1', contentHash: 'h1' }],
      stored: [{ repoId: 'r1', embeddingModel: 'legacy-model', contentHash: 'h1' }],
    });
    expect(result).toEqual([{ repoId: 'r1', reason: 'model_mismatch' }]);
  });

  it('marks repos whose stored content hash is stale', () => {
    const result = selectReposToEmbed({
      model,
      desired: [{ repoId: 'r1', contentHash: 'h2' }],
      stored: [{ repoId: 'r1', embeddingModel: model, contentHash: 'h1' }],
    });
    expect(result).toEqual([{ repoId: 'r1', reason: 'content_mismatch' }]);
  });

  it('skips repos whose model and content hash both match (fresh)', () => {
    const result = selectReposToEmbed({
      model,
      desired: [{ repoId: 'r1', contentHash: 'h1' }],
      stored: [{ repoId: 'r1', embeddingModel: model, contentHash: 'h1' }],
    });
    expect(result).toEqual([]);
  });

  it('prefers model mismatch over content mismatch when both differ', () => {
    const result = selectReposToEmbed({
      model,
      desired: [{ repoId: 'r1', contentHash: 'h2' }],
      stored: [{ repoId: 'r1', embeddingModel: 'legacy-model', contentHash: 'h1' }],
    });
    expect(result).toEqual([{ repoId: 'r1', reason: 'model_mismatch' }]);
  });

  it('is incremental and resumable across a mixed desired set', () => {
    const result = selectReposToEmbed({
      model,
      desired: [
        { repoId: 'fresh', contentHash: 'h1' },
        { repoId: 'new', contentHash: 'h1' },
        { repoId: 'stale-model', contentHash: 'h1' },
        { repoId: 'stale-content', contentHash: 'h2' },
      ],
      stored: [
        { repoId: 'fresh', embeddingModel: model, contentHash: 'h1' },
        { repoId: 'stale-model', embeddingModel: 'legacy-model', contentHash: 'h1' },
        { repoId: 'stale-content', embeddingModel: model, contentHash: 'h1' },
        { repoId: 'orphan', embeddingModel: model, contentHash: 'h9' },
      ],
    });
    expect(result).toEqual([
      { repoId: 'new', reason: 'missing' },
      { repoId: 'stale-model', reason: 'model_mismatch' },
      { repoId: 'stale-content', reason: 'content_mismatch' },
    ]);
  });
});
