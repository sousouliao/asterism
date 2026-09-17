import type { Memory } from '../models/memory';
import type { Repo } from '../models/repo';

/** 列表项：仓库 + 当前用户对它的收藏时间（用于按 starredAt 排序）。 */
export interface StarredRepoLike {
  repo: Repo;
  starredAt: string | null;
  /** Postgres `repos.id`；按集合筛选时需要。 */
  repoId?: string;
}

export type RepoStatus = 'all' | 'active' | 'archived';
export type RepoSort = 'starred' | 'pushed' | 'stars' | 'name';

export interface RepoFilter {
  /** 关键词：匹配 owner / name / fullName / description / topics（大小写不敏感）。 */
  query?: string;
  language?: string | null;
  topic?: string | null;
  minStars?: number;
  /** 仅保留最近 N 天有 push 的仓库；null/缺省表示不限。 */
  pushedWithinDays?: number | null;
  status?: RepoStatus;
  /** 至少命中其中一个 collection（OR）；缺省或空数组表示不限。 */
  collectionIds?: string[];
}

export interface RepoFacets {
  /** 出现过的语言（按字母序）。 */
  languages: string[];
  /** 出现过的 topic（按出现频次降序、同频按字母序）。 */
  topics: string[];
}

const EMPTY_FILTER: Required<Omit<RepoFilter, 'language' | 'topic'>> & {
  language: string | null;
  topic: string | null;
} = {
  query: '',
  language: null,
  topic: null,
  minStars: 0,
  pushedWithinDays: null,
  status: 'all',
  collectionIds: [],
};

function matchesQuery(repo: Repo, query: string, memory?: Memory): boolean {
  const haystack = [
    repo.fullName,
    repo.owner,
    repo.name,
    repo.description ?? '',
    ...repo.topics,
    memory?.whySaved ?? '',
    memory?.note ?? '',
  ]
    .join('\n')
    .toLowerCase();
  return haystack.includes(query);
}

/** 是否设置了任何收窄条件（用于「清除筛选」按钮的显隐）。 */
export function hasActiveFilter(filter: RepoFilter): boolean {
  return (
    Boolean(filter.query?.trim()) ||
    Boolean(filter.language) ||
    Boolean(filter.topic) ||
    (filter.minStars ?? 0) > 0 ||
    filter.pushedWithinDays != null ||
    (filter.status ?? 'all') !== 'all' ||
    (filter.collectionIds?.length ?? 0) > 0
  );
}

/** 客户端本地筛选，多条件可组合（AND）。不修改输入。 */
export function filterStarredRepos<T extends StarredRepoLike>(
  items: T[],
  filter: RepoFilter,
  now: number = Date.now(),
  collectionsByRepoId?: Map<string, string[]>,
  memoriesByRepoId?: Map<string, Memory>,
): T[] {
  const f = {
    ...EMPTY_FILTER,
    ...filter,
    collectionIds: filter.collectionIds ?? EMPTY_FILTER.collectionIds,
  };
  const query = f.query.trim().toLowerCase();
  const pushedCutoff =
    f.pushedWithinDays != null ? now - f.pushedWithinDays * 24 * 60 * 60 * 1000 : null;
  const collectionFilter = f.collectionIds.length > 0;

  return items.filter((item) => {
    const { repo, repoId } = item;
    if (collectionFilter) {
      if (!repoId) {
        return false;
      }
      const repoCollectionIds = collectionsByRepoId?.get(repoId) ?? [];
      if (!f.collectionIds.some((collectionId) => repoCollectionIds.includes(collectionId))) {
        return false;
      }
    }
    const memory = repoId ? memoriesByRepoId?.get(repoId) : undefined;
    if (query && !matchesQuery(repo, query, memory)) {
      return false;
    }
    if (f.language && repo.language !== f.language) {
      return false;
    }
    if (f.topic && !repo.topics.includes(f.topic)) {
      return false;
    }
    if (f.minStars > 0 && repo.stargazers < f.minStars) {
      return false;
    }
    if (f.status === 'active' && repo.archived) {
      return false;
    }
    if (f.status === 'archived' && !repo.archived) {
      return false;
    }
    if (pushedCutoff != null) {
      const pushed = repo.pushedAt ? Date.parse(repo.pushedAt) : Number.NaN;
      if (!Number.isFinite(pushed) || pushed < pushedCutoff) {
        return false;
      }
    }
    return true;
  });
}

function timeValue(iso: string | null): number {
  if (!iso) {
    return Number.NEGATIVE_INFINITY;
  }
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

/** 按指定维度排序（稳定、降序为主；name 为升序）。不修改输入。 */
export function sortStarredRepos<T extends StarredRepoLike>(items: T[], sort: RepoSort): T[] {
  const copy = items.slice();
  switch (sort) {
    case 'pushed':
      return copy.sort((a, b) => timeValue(b.repo.pushedAt) - timeValue(a.repo.pushedAt));
    case 'stars':
      return copy.sort((a, b) => b.repo.stargazers - a.repo.stargazers);
    case 'name':
      return copy.sort((a, b) => a.repo.fullName.localeCompare(b.repo.fullName));
    default:
      return copy.sort((a, b) => timeValue(b.starredAt) - timeValue(a.starredAt));
  }
}

/** 从数据集中提取可选的语言 / topic facets（用于筛选下拉项）。 */
export function deriveRepoFacets(items: StarredRepoLike[]): RepoFacets {
  const languages = new Set<string>();
  const topicCounts = new Map<string, number>();
  for (const { repo } of items) {
    if (repo.language) {
      languages.add(repo.language);
    }
    for (const topic of repo.topics) {
      topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
    }
  }
  const topics = [...topicCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([topic]) => topic);
  return {
    languages: [...languages].sort((a, b) => a.localeCompare(b)),
    topics,
  };
}
