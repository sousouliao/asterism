import type { Repo } from '@asterism/core';
import type { SupabaseClient } from '../client';
import type { Tables } from '../database.types';

export interface StarredRepoRecord {
  /** repos 表主键（uuid），用于 collections/memories 等关联写入。 */
  repoId: string;
  repo: Repo;
  starredAt: string | null;
  /** Null while still starred; timestamp is when a completed sync detected removal. */
  unstarredAt?: string | null;
}

interface StarredJoinRow {
  starred_at: string | null;
  unstarred_at: string | null;
  repos: Tables<'repos'> | null;
}

const POSTGREST_PAGE_SIZE = 1_000;

/** 把 `repos` 表行（snake_case）映射为领域 `Repo`（camelCase）。 */
export function mapRepoRow(row: Tables<'repos'>): Repo {
  return {
    githubId: row.github_id,
    fullName: row.full_name,
    name: row.name,
    owner: row.owner,
    description: row.description,
    language: row.language,
    topics: row.topics,
    stargazers: row.stargazers,
    forks: row.forks,
    homepage: row.homepage,
    pushedAt: row.pushed_at,
    repoCreatedAt: row.repo_created_at,
    archived: row.archived,
    isFork: row.is_fork,
    syncedAt: row.synced_at,
  };
}

/**
 * 读取当前用户 star 的全部仓库（user_stars ⋈ repos），按 starredAt 倒序。
 * 读取走 RLS：repos 全局可读、user_stars 按 user_id 隔离。
 */
async function listRepos(
  client: SupabaseClient,
  userId: string,
  includeHistory: boolean,
): Promise<StarredRepoRecord[]> {
  const rows: StarredJoinRow[] = [];
  for (let offset = 0; ; offset += POSTGREST_PAGE_SIZE) {
    let query = client
      .from('user_stars')
      .select('starred_at, unstarred_at, repos(*)')
      .eq('user_id', userId);
    if (!includeHistory) query = query.is('unstarred_at', null);
    const { data, error } = await query
      .order('starred_at', { ascending: false, nullsFirst: false })
      .order('repo_id', { ascending: true })
      .range(offset, offset + POSTGREST_PAGE_SIZE - 1)
      .returns<StarredJoinRow[]>();

    if (error) {
      throw error;
    }
    const page = data ?? [];
    rows.push(...page);
    if (page.length < POSTGREST_PAGE_SIZE) {
      break;
    }
  }

  const records: StarredRepoRecord[] = [];
  for (const row of rows) {
    if (row.repos) {
      records.push({
        repoId: row.repos.id,
        repo: mapRepoRow(row.repos),
        starredAt: row.starred_at,
        unstarredAt: row.unstarred_at,
      });
    }
  }
  return records;
}

/** 当前仍在 GitHub Star 列表中的仓库。 */
export function listStarredRepos(client: SupabaseClient, userId: string) {
  return listRepos(client, userId, false);
}

/** 全部曾收藏的仓库，含已取消 Star 的历史。 */
export function listLibraryRepos(client: SupabaseClient, userId: string) {
  return listRepos(client, userId, true);
}
