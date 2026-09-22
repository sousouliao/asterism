import { describe, expect, it } from 'vitest';
import {
  collectStarredRepos,
  type FetchStarredPage,
  mapStarEdgeToRepo,
  type RawStarEdge,
  type StarredPage,
} from './stars';

function makeEdge(
  databaseId: number,
  starredAt: string,
  overrides: Partial<RawStarEdge['node']> = {},
): RawStarEdge {
  return {
    starredAt,
    node: {
      databaseId,
      name: `repo-${databaseId}`,
      nameWithOwner: `owner/repo-${databaseId}`,
      owner: { login: 'owner' },
      description: null,
      primaryLanguage: { name: 'TypeScript' },
      repositoryTopics: { nodes: [{ topic: { name: 'cli' } }] },
      stargazerCount: 10,
      forkCount: 2,
      homepageUrl: null,
      pushedAt: '2026-01-01T00:00:00Z',
      createdAt: '2020-01-01T00:00:00Z',
      isArchived: false,
      isFork: false,
      ...overrides,
    },
  };
}

describe('mapStarEdgeToRepo', () => {
  it('maps GraphQL node fields to the domain Repo shape', () => {
    const result = mapStarEdgeToRepo(makeEdge(1, '2026-02-02T00:00:00Z'), '2026-06-30T00:00:00Z');
    expect(result.starredAt).toBe('2026-02-02T00:00:00Z');
    expect(result.repo).toMatchObject({
      githubId: 1,
      fullName: 'owner/repo-1',
      name: 'repo-1',
      owner: 'owner',
      language: 'TypeScript',
      topics: ['cli'],
      stargazers: 10,
      forks: 2,
      archived: false,
      isFork: false,
      syncedAt: '2026-06-30T00:00:00Z',
    });
  });

  it('falls back to null language when primaryLanguage is absent', () => {
    const result = mapStarEdgeToRepo(
      makeEdge(2, '2026-02-02T00:00:00Z', { primaryLanguage: null }),
      '2026-06-30T00:00:00Z',
    );
    expect(result.repo.language).toBeNull();
  });
});

function pageFromEdges(
  edges: RawStarEdge[],
  hasNextPage: boolean,
  endCursor: string | null,
): StarredPage {
  const syncedAt = '2026-06-30T00:00:00Z';
  return {
    repos: edges.map((edge) => mapStarEdgeToRepo(edge, syncedAt)),
    hasNextPage,
    endCursor,
  };
}

describe('collectStarredRepos', () => {
  it('walks all pages until hasNextPage is false', async () => {
    const pages: StarredPage[] = [
      pageFromEdges(
        [makeEdge(1, '2026-03-03T00:00:00Z'), makeEdge(2, '2026-03-02T00:00:00Z')],
        true,
        'c1',
      ),
      pageFromEdges([makeEdge(3, '2026-03-01T00:00:00Z')], false, null),
    ];
    const calls: (string | null)[] = [];
    const fetchPage: FetchStarredPage = async (cursor) => {
      calls.push(cursor);
      return pages[calls.length - 1] as StarredPage;
    };

    const result = await collectStarredRepos(fetchPage);
    expect(result.map((item) => item.repo.githubId)).toEqual([1, 2, 3]);
    expect(calls).toEqual([null, 'c1']);
  });

  it('rejects a repository without a databaseId', async () => {
    const page = pageFromEdges(
      [makeEdge(0, '2026-03-03T00:00:00Z'), makeEdge(5, '2026-03-02T00:00:00Z')],
      false,
      null,
    );
    const fetchPage: FetchStarredPage = async () => page;

    await expect(collectStarredRepos(fetchPage)).rejects.toThrow('without an ID');
  });

  it('rejects an incomplete pagination cursor', async () => {
    const fetchPage: FetchStarredPage = async () =>
      pageFromEdges([makeEdge(1, '2026-03-03T00:00:00Z')], true, null);
    await expect(collectStarredRepos(fetchPage)).rejects.toThrow('before the final page');
  });

  it('rejects a cursor that does not advance', async () => {
    const fetchPage: FetchStarredPage = async () =>
      pageFromEdges([makeEdge(1, '2026-03-03T00:00:00Z')], true, 'c1');
    await expect(collectStarredRepos(fetchPage)).rejects.toThrow('before the final page');
  });
});
