import { describe, expect, it } from 'vitest';
import type { Memory } from '../models/memory';
import type { Repo } from '../models/repo';
import type { StarredRepoLike } from './filter';
import { deriveResurfaceStreams } from './resurface';

const MS_PER_DAY = 86_400_000;
const NOW = Date.parse('2026-06-30T00:00:00Z');

function daysAgo(days: number): string {
  return new Date(NOW - days * MS_PER_DAY).toISOString();
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

function item(
  overrides: Partial<Repo>,
  repoId: string,
  starredAt: string | null = daysAgo(400),
): StarredRepoLike {
  return { repo: makeRepo(overrides), starredAt, repoId };
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

describe('deriveResurfaceStreams · eligibility', () => {
  it('returns empty streams for empty input', () => {
    const streams = deriveResurfaceStreams({ items: [], now: NOW });
    expect(streams.worthRemembering).toEqual([]);
    expect(streams.missingContext).toEqual([]);
  });

  it('skips items without repoId, starredAt, or with future / too-recent stars', () => {
    const streams = deriveResurfaceStreams({
      items: [
        item({}, 'no-time', null),
        item({ fullName: 'owner/future' }, 'future', new Date(NOW + MS_PER_DAY).toISOString()),
        item({ fullName: 'owner/fresh' }, 'fresh', daysAgo(10)),
      ],
      now: NOW,
    });
    expect(streams.worthRemembering).toEqual([]);
    expect(streams.missingContext).toEqual([]);
  });

  it('excludes suppressed repoIds from both streams', () => {
    const streams = deriveResurfaceStreams({
      items: [item({ stargazers: 20_000 }, 'r1')],
      suppressedRepoIds: new Set(['r1']),
      now: NOW,
    });
    expect(streams.missingContext).toEqual([]);
  });

  it('includes a 30-day-old unrecorded star but not a 29-day-old one', () => {
    const streams = deriveResurfaceStreams({
      items: [item({}, 'r30', daysAgo(30)), item({}, 'r29', daysAgo(29))],
      now: NOW,
    });
    expect(streams.missingContext.map((entry) => entry.repoId)).toEqual(['r30']);
  });
});

describe('deriveResurfaceStreams · worth remembering', () => {
  it('surfaces a dormant repo with a note, ordered noted before dormant', () => {
    const streams = deriveResurfaceStreams({
      items: [item({ pushedAt: daysAgo(10) }, 'r1')],
      memoriesByRepoId: new Map([['r1', memory('r1', { note: '性能表现优异' })]]),
      now: NOW,
    });
    expect(streams.worthRemembering).toHaveLength(1);
    const candidate = streams.worthRemembering[0];
    expect(candidate?.repoId).toBe('r1');
    expect(candidate?.primaryReason.kind).toBe('noted');
    expect(candidate?.reasons.map((reason) => reason.kind)).toEqual(['noted', 'dormant']);
  });

  it('treats an exact integer-year star as an anniversary with the year count', () => {
    const streams = deriveResurfaceStreams({
      items: [item({}, 'r1', '2024-06-30T00:00:00Z')],
      now: NOW,
    });
    const candidate = streams.worthRemembering[0];
    expect(candidate?.primaryReason).toEqual({ kind: 'anniversary', years: 2 });
    expect(candidate?.reasons.map((reason) => reason.kind)).toEqual(['anniversary']);
  });

  it('keeps anniversaries within the ±3 day window and drops those outside', () => {
    const streams = deriveResurfaceStreams({
      items: [
        item({}, 'edge', '2024-06-27T00:00:00Z'),
        item({}, 'outside', '2024-06-26T12:00:00Z'),
      ],
      memoriesByRepoId: new Map([['outside', memory('outside', { note: 'n' })]]),
      now: NOW,
    });
    const kinds = new Map(
      streams.worthRemembering.map((entry) => [entry.repoId, entry.primaryReason.kind]),
    );
    expect(kinds.get('edge')).toBe('anniversary');
    expect(kinds.get('outside')).toBe('noted');
    expect(
      streams.worthRemembering
        .find((entry) => entry.repoId === 'outside')
        ?.reasons.some((reason) => reason.kind === 'anniversary'),
    ).toBe(false);
  });

  it('recognizes an anniversary falling up to 3 days ahead of now', () => {
    const streams = deriveResurfaceStreams({
      items: [item({}, 'upcoming', daysAgo(727))],
      now: NOW,
    });
    expect(streams.worthRemembering[0]?.primaryReason).toEqual({ kind: 'anniversary', years: 2 });
  });

  it('accepts a why_saved-only dormant repo, but surfaces only the dormant reason', () => {
    const streams = deriveResurfaceStreams({
      items: [item({}, 'r1')],
      memoriesByRepoId: new Map([['r1', memory('r1', { whySaved: '网关替换备选' })]]),
      now: NOW,
    });
    expect(streams.worthRemembering[0]?.reasons.map((reason) => reason.kind)).toEqual(['dormant']);
    expect(streams.missingContext).toEqual([]);
  });

  it('adds a repo_quiet reason when the repo has not been pushed for over two years', () => {
    const streams = deriveResurfaceStreams({
      items: [item({ pushedAt: daysAgo(1100) }, 'r1')],
      memoriesByRepoId: new Map([['r1', memory('r1', { note: 'note' })]]),
      now: NOW,
    });
    expect(streams.worthRemembering[0]?.reasons.map((reason) => reason.kind)).toEqual([
      'noted',
      'repo_quiet',
      'dormant',
    ]);
  });

  it('does not surface dormant repos without any personal signal as worth remembering', () => {
    const streams = deriveResurfaceStreams({
      items: [item({}, 'r1', '2024-06-26T12:00:00Z')],
      now: NOW,
    });
    expect(streams.worthRemembering).toEqual([]);
  });

  it('caps the stream at three candidates ordered by score', () => {
    const streams = deriveResurfaceStreams({
      items: [
        item({ fullName: 'owner/anniv' }, 'anniv', '2024-06-30T00:00:00Z'),
        item({ fullName: 'owner/note-old' }, 'note-old', daysAgo(1200)),
        item({ fullName: 'owner/note-mid' }, 'note-mid', daysAgo(800)),
        item({ fullName: 'owner/z-extra' }, 'z-extra', daysAgo(1100)),
        item({ fullName: 'owner/note-young' }, 'note-young', daysAgo(200)),
      ],
      memoriesByRepoId: new Map([
        ['note-old', memory('note-old', { note: 'n' })],
        ['note-mid', memory('note-mid', { note: 'n' })],
        ['note-young', memory('note-young', { note: 'n' })],
        ['z-extra', memory('z-extra', { note: 'n' })],
      ]),
      now: NOW,
    });
    expect(streams.worthRemembering.map((entry) => entry.repoId)).toEqual([
      'anniv',
      'note-old',
      'z-extra',
    ]);
  });
});

describe('deriveResurfaceStreams · missing context', () => {
  it('explains an unrecorded high-value star with ordered reasons', () => {
    const streams = deriveResurfaceStreams({
      items: [item({ stargazers: 5000 }, 'r1', daysAgo(100))],
      memoriesByRepoId: new Map([['r1', memory('r1', { note: '有笔记但没写原因' })]]),
      now: NOW,
    });
    const candidate = streams.missingContext[0];
    expect(candidate?.reasons).toEqual([
      { kind: 'missing_why_saved' },
      { kind: 'noted_without_reason' },
      { kind: 'high_value', stargazers: 5000 },
    ]);
  });

  it('adds a dormant reason for unrecorded stars older than a year', () => {
    const streams = deriveResurfaceStreams({
      items: [item({ stargazers: 5000 }, 'r1', daysAgo(400))],
      now: NOW,
    });
    expect(streams.missingContext[0]?.reasons).toEqual([
      { kind: 'missing_why_saved' },
      { kind: 'high_value', stargazers: 5000 },
      { kind: 'dormant', days: 400 },
    ]);
  });

  it('omits the high_value reason below 1000 stargazers', () => {
    const streams = deriveResurfaceStreams({
      items: [item({ stargazers: 999 }, 'r1', daysAgo(100))],
      now: NOW,
    });
    expect(streams.missingContext[0]?.reasons.map((reason) => reason.kind)).toEqual([
      'missing_why_saved',
    ]);
  });

  it('does not include repos that already record why_saved', () => {
    const streams = deriveResurfaceStreams({
      items: [item({}, 'r1', daysAgo(40))],
      memoriesByRepoId: new Map([['r1', memory('r1', { whySaved: '已经写了' })]]),
      now: NOW,
    });
    expect(streams.missingContext).toEqual([]);
  });

  it('treats a whitespace-only why_saved as unrecorded', () => {
    const streams = deriveResurfaceStreams({
      items: [item({}, 'r1')],
      memoriesByRepoId: new Map([['r1', memory('r1', { whySaved: '   ' })]]),
      now: NOW,
    });
    expect(streams.missingContext).toHaveLength(1);
  });

  it('orders primarily by stargazers and breaks ties deterministically by full name', () => {
    const streams = deriveResurfaceStreams({
      items: [
        item({ fullName: 'a/aaa', stargazers: 1200 }, 'r1'),
        item({ fullName: 'z/zzz', stargazers: 9000 }, 'r2'),
        item({ fullName: 'b/bbb', stargazers: 1200 }, 'r3'),
      ],
      now: NOW,
    });
    expect(streams.missingContext.map((entry) => entry.repoId)).toEqual(['r2', 'r1']);
  });
});

describe('deriveResurfaceStreams · stream precedence and determinism', () => {
  it('routes a repo eligible for both streams only into worth remembering', () => {
    const streams = deriveResurfaceStreams({
      items: [item({ stargazers: 20_000 }, 'r1', '2024-06-30T00:00:00Z')],
      now: NOW,
    });
    expect(streams.worthRemembering.map((entry) => entry.repoId)).toEqual(['r1']);
    expect(streams.missingContext).toEqual([]);
  });

  it('keeps primaryReason identical to reasons[0] and honors custom limits', () => {
    const streams = deriveResurfaceStreams({
      items: [
        item({}, 'a', daysAgo(400)),
        item({}, 'b', daysAgo(500)),
        item({}, 'c', daysAgo(600)),
      ],
      now: NOW,
      missingContextLimit: 1,
    });
    expect(streams.missingContext).toHaveLength(1);
    for (const candidate of streams.missingContext) {
      expect(candidate.primaryReason).toBe(candidate.reasons[0]);
    }
  });
});
