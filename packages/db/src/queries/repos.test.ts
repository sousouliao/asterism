import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '../client';
import type { Tables } from '../database.types';
import { listLibraryRepos, listStarredRepos } from './repos';

function repoRow(index: number): Tables<'repos'> {
  return {
    id: `repo-${index}`,
    github_id: index,
    full_name: `owner/repo-${index}`,
    name: `repo-${index}`,
    owner: 'owner',
    description: null,
    language: null,
    topics: [],
    stargazers: 0,
    forks: 0,
    homepage: null,
    pushed_at: null,
    repo_created_at: null,
    archived: false,
    is_fork: false,
    synced_at: '2026-07-24T00:00:00.000Z',
    created_at: '2026-07-24T00:00:00.000Z',
    updated_at: '2026-07-24T00:00:00.000Z',
  };
}

describe('listStarredRepos', () => {
  it('paginates past the PostgREST row limit', async () => {
    const pages = [
      Array.from({ length: 1_000 }, (_, index) => ({
        starred_at: '2026-07-24T00:00:00.000Z',
        unstarred_at: null,
        repos: repoRow(index),
      })),
      [{ starred_at: '2026-07-23T00:00:00.000Z', unstarred_at: null, repos: repoRow(1_000) }],
    ];
    const ranges: Array<{ from: number; to: number }> = [];
    let pageIndex = 0;
    const client = {
      from() {
        const builder = {
          select() {
            return builder;
          },
          eq() {
            return builder;
          },
          is() {
            return builder;
          },
          order() {
            return builder;
          },
          range(from: number, to: number) {
            ranges.push({ from, to });
            return builder;
          },
          returns() {
            const data = pages[pageIndex] ?? [];
            pageIndex += 1;
            return Promise.resolve({ data, error: null });
          },
        };
        return builder;
      },
    } as unknown as SupabaseClient;

    const records = await listStarredRepos(client, 'user-1');

    expect(records).toHaveLength(1_001);
    expect(records.at(-1)?.repoId).toBe('repo-1000');
    expect(ranges).toEqual([
      { from: 0, to: 999 },
      { from: 1_000, to: 1_999 },
    ]);
  });

  it('retains historical repositories with their detected unstar time', async () => {
    const client = {
      from() {
        const builder = {
          select() {
            return builder;
          },
          eq() {
            return builder;
          },
          order() {
            return builder;
          },
          range() {
            return builder;
          },
          returns() {
            return Promise.resolve({
              data: [
                {
                  starred_at: '2026-07-23T00:00:00Z',
                  unstarred_at: '2026-09-22T00:00:00Z',
                  repos: repoRow(1),
                },
              ],
              error: null,
            });
          },
        };
        return builder;
      },
    } as unknown as SupabaseClient;
    expect((await listLibraryRepos(client, 'user-1'))[0]?.unstarredAt).toBe('2026-09-22T00:00:00Z');
  });
});
