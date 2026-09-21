import type { Memory } from '../models/memory';
import { tokenizeQuestion } from './ask-candidates';
import type { StarredRepoLike } from './filter';

export const ASK_SEARCH_DEFAULT_LIMIT = 50;
export const ASK_FILTER_PAGE_SIZE = 80;
export const ASK_EXPAND_MAX_IDS = 12;

export interface AskToolFilterInput {
  language?: string;
  topics?: string[];
  nameContains?: string;
  starredAfter?: string;
  starredBefore?: string;
  offset?: number;
  limit?: number;
}

export interface AskToolSearchInput {
  query: string;
  limit?: number;
}

export interface AskToolExpandInput {
  ids: string[];
}

export interface AskToolHit {
  repoId: string;
  fullName: string;
  language: string | null;
  topics: string[];
  description: string | null;
  stargazers: number;
  starredAt: string | null;
  score?: number;
}

export interface AskToolFilterResult {
  total: number;
  offset: number;
  hasMore: boolean;
  items: AskToolHit[];
}

export interface AskToolExpanded {
  repoId: string;
  fullName: string;
  description: string | null;
  language: string | null;
  topics: string[];
  stargazers: number;
  starredAt: string | null;
  whySaved: string | null;
  note: string | null;
}

export interface AskToolContext<T extends StarredRepoLike> {
  items: readonly T[];
  memoriesByRepoId?: ReadonlyMap<string, Memory>;
  includeNotes?: boolean;
}

type CatalogItem<T extends StarredRepoLike> = T & { repoId: string };

function withRepoId<T extends StarredRepoLike>(items: readonly T[]): CatalogItem<T>[] {
  return items.filter((item): item is CatalogItem<T> => Boolean(item.repoId));
}

function toHit<T extends StarredRepoLike>(item: CatalogItem<T>, score?: number): AskToolHit {
  return {
    repoId: item.repoId,
    fullName: item.repo.fullName,
    language: item.repo.language,
    topics: item.repo.topics,
    description: item.repo.description,
    stargazers: item.repo.stargazers,
    starredAt: item.starredAt,
    ...(score === undefined ? {} : { score }),
  };
}

function compareHits(
  left: CatalogItem<StarredRepoLike>,
  right: CatalogItem<StarredRepoLike>,
): number {
  return (
    right.repo.stargazers - left.repo.stargazers ||
    left.repo.fullName.localeCompare(right.repo.fullName) ||
    left.repoId.localeCompare(right.repoId)
  );
}

function lexicalScore<T extends StarredRepoLike>(
  item: CatalogItem<T>,
  terms: readonly string[],
  memory: Memory | undefined,
): number {
  let score = 0;
  const whySaved = memory?.whySaved?.toLowerCase();
  const note = memory?.note?.toLowerCase();
  const description = item.repo.description?.toLowerCase();
  const name = item.repo.name.toLowerCase();
  const fullName = item.repo.fullName.toLowerCase();
  for (const term of terms) {
    if (whySaved?.includes(term)) score += 5;
    if (note?.includes(term)) score += 4;
    if (name.includes(term) || fullName.includes(term)) score += 4;
    if (item.repo.language?.toLowerCase() === term) score += 3;
    if (item.repo.topics.some((topic) => topic.toLowerCase() === term)) score += 3;
    if (description?.includes(term)) score += 2;
  }
  return score;
}

/** 结构化穷举过滤：无分数门槛，返回完整结果集的一页并告知总数。 */
export function filterAskRepos<T extends StarredRepoLike>(
  context: AskToolContext<T>,
  input: AskToolFilterInput,
): AskToolFilterResult {
  const language = input.language?.trim().toLowerCase();
  const topics = (input.topics ?? []).map((topic) => topic.trim().toLowerCase()).filter(Boolean);
  const nameContains = input.nameContains?.trim().toLowerCase();
  const starredAfter = input.starredAfter ? Date.parse(input.starredAfter) : Number.NaN;
  const starredBefore = input.starredBefore ? Date.parse(input.starredBefore) : Number.NaN;
  const offset = Math.max(0, input.offset ?? 0);
  const limit = Math.min(ASK_FILTER_PAGE_SIZE, Math.max(1, input.limit ?? ASK_FILTER_PAGE_SIZE));

  const matched = withRepoId(context.items)
    .filter((item) => {
      if (language && item.repo.language?.toLowerCase() !== language) {
        return false;
      }
      if (
        topics.length > 0 &&
        !topics.every((topic) => item.repo.topics.some((entry) => entry.toLowerCase() === topic))
      ) {
        return false;
      }
      if (
        nameContains &&
        !item.repo.name.toLowerCase().includes(nameContains) &&
        !item.repo.fullName.toLowerCase().includes(nameContains)
      ) {
        return false;
      }
      if (Number.isFinite(starredAfter)) {
        const starredAt = item.starredAt ? Date.parse(item.starredAt) : Number.NaN;
        if (!Number.isFinite(starredAt) || starredAt < starredAfter) {
          return false;
        }
      }
      if (Number.isFinite(starredBefore)) {
        const starredAt = item.starredAt ? Date.parse(item.starredAt) : Number.NaN;
        if (!Number.isFinite(starredAt) || starredAt > starredBefore) {
          return false;
        }
      }
      return true;
    })
    .toSorted(compareHits);

  return {
    total: matched.length,
    offset,
    hasMore: offset + limit < matched.length,
    items: matched.slice(offset, offset + limit).map((item) => toHit(item)),
  };
}

/**
 * 词法模糊查询：取消最低分门槛，默认最多 50 条。
 * 宁可多给噪音让模型筛，不在模型看不见的地方做减法。
 */
export function searchAskRepos<T extends StarredRepoLike>(
  context: AskToolContext<T>,
  input: AskToolSearchInput,
): AskToolHit[] {
  const terms = tokenizeQuestion(input.query);
  if (terms.length === 0) {
    return [];
  }
  const limit = Math.min(200, Math.max(1, input.limit ?? ASK_SEARCH_DEFAULT_LIMIT));
  return withRepoId(context.items)
    .map((item) => {
      const score = lexicalScore(item, terms, context.memoriesByRepoId?.get(item.repoId));
      return { item, score };
    })
    .filter((entry) => entry.score > 0)
    .toSorted((left, right) => right.score - left.score || compareHits(left.item, right.item))
    .slice(0, limit)
    .map((entry) => toHit(entry.item, entry.score));
}

/** 展开完整仓库信息；笔记受 includeNotes 约束。未知 id 被跳过。 */
export function expandAskRepos<T extends StarredRepoLike>(
  context: AskToolContext<T>,
  input: AskToolExpandInput,
): AskToolExpanded[] {
  const byId = new Map(withRepoId(context.items).map((item) => [item.repoId, item]));
  const includeNotes = context.includeNotes !== false;
  const seen = new Set<string>();
  const expanded: AskToolExpanded[] = [];
  for (const rawId of input.ids) {
    const repoId = rawId.trim();
    if (!repoId || seen.has(repoId) || expanded.length >= ASK_EXPAND_MAX_IDS) {
      continue;
    }
    const item = byId.get(repoId);
    if (!item) {
      continue;
    }
    seen.add(repoId);
    const memory = context.memoriesByRepoId?.get(repoId);
    expanded.push({
      repoId,
      fullName: item.repo.fullName,
      description: item.repo.description,
      language: item.repo.language,
      topics: item.repo.topics,
      stargazers: item.repo.stargazers,
      starredAt: item.starredAt,
      whySaved: includeNotes ? (memory?.whySaved ?? null) : null,
      note: includeNotes ? (memory?.note ?? null) : null,
    });
  }
  return expanded;
}

export const ASK_TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'filter',
      description:
        'Exact structured filter over the users entire collection. Returns the full matching set in pages and the total count. Use when the user names language, topics, name fragments, or star dates.',
      parameters: {
        type: 'object',
        properties: {
          language: { type: 'string', description: 'Exact programming language, e.g. Rust' },
          topics: {
            type: 'array',
            items: { type: 'string' },
            description: 'GitHub topics that must all match',
          },
          nameContains: { type: 'string', description: 'Substring of repository name or fullName' },
          starredAfter: {
            type: 'string',
            description: 'ISO date; keep stars on or after this day',
          },
          starredBefore: {
            type: 'string',
            description: 'ISO date; keep stars on or before this day',
          },
          offset: { type: 'integer', description: 'Pagination offset, default 0' },
          limit: { type: 'integer', description: `Page size, max ${ASK_FILTER_PAGE_SIZE}` },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search',
      description:
        'Lexical search over names, descriptions, topics, languages, and Memory notes. No minimum score. Prefer filter for exact language or topic questions.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Natural-language or keyword query' },
          limit: { type: 'integer', description: `Max hits, default ${ASK_SEARCH_DEFAULT_LIMIT}` },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'expand',
      description:
        'Read full metadata and the users private Memory notes for specific repositories. You MUST expand a repository before recommending it.',
      parameters: {
        type: 'object',
        properties: {
          ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'repoId values from the catalog or a previous tool result',
          },
        },
        required: ['ids'],
      },
    },
  },
] as const;

export type AskToolName = 'filter' | 'search' | 'expand';

export function isAskToolName(value: string): value is AskToolName {
  return value === 'filter' || value === 'search' || value === 'expand';
}

export function executeAskTool<T extends StarredRepoLike>(
  context: AskToolContext<T>,
  name: string,
  rawArguments: string,
):
  | { ok: true; name: AskToolName; result: unknown; expandedIds: string[] }
  | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = rawArguments.trim().length === 0 ? {} : JSON.parse(rawArguments);
  } catch {
    return { ok: false, error: 'invalid_json' };
  }
  if (parsed === null || typeof parsed !== 'object') {
    return { ok: false, error: 'invalid_arguments' };
  }
  const args = parsed as Record<string, unknown>;
  if (name === 'filter') {
    const result = filterAskRepos(context, {
      language: typeof args.language === 'string' ? args.language : undefined,
      topics: Array.isArray(args.topics)
        ? args.topics.filter((topic): topic is string => typeof topic === 'string')
        : undefined,
      nameContains: typeof args.nameContains === 'string' ? args.nameContains : undefined,
      starredAfter: typeof args.starredAfter === 'string' ? args.starredAfter : undefined,
      starredBefore: typeof args.starredBefore === 'string' ? args.starredBefore : undefined,
      offset: typeof args.offset === 'number' ? args.offset : undefined,
      limit: typeof args.limit === 'number' ? args.limit : undefined,
    });
    return { ok: true, name, result, expandedIds: [] };
  }
  if (name === 'search') {
    if (typeof args.query !== 'string') {
      return { ok: false, error: 'missing_query' };
    }
    const result = searchAskRepos(context, {
      query: args.query,
      limit: typeof args.limit === 'number' ? args.limit : undefined,
    });
    return { ok: true, name, result, expandedIds: [] };
  }
  if (name === 'expand') {
    const ids = Array.isArray(args.ids)
      ? args.ids.filter((id): id is string => typeof id === 'string')
      : [];
    const result = expandAskRepos(context, { ids });
    return { ok: true, name, result, expandedIds: result.map((entry) => entry.repoId) };
  }
  return { ok: false, error: 'unknown_tool' };
}
