import type { Memory } from '../models/memory';
import {
  filterStarredRepos,
  type RepoFilter,
  type RepoSort,
  type StarredRepoLike,
  sortStarredRepos,
} from './filter';

export type MatchReasonKind =
  | 'why_saved'
  | 'note'
  | 'name'
  | 'description'
  | 'topic'
  | 'semantic_memory'
  | 'semantic_repo';

export interface MatchReason {
  kind: MatchReasonKind;
  /** 命中上下文片段或高亮目标文本 */
  snippet?: string;
  /** 命中完整原文（避免截断，供浮层完整阅读） */
  fullText?: string;
  /** 命中所在的主题名称或字段标示 */
  matchedField?: string;
}

export interface MatchExplanation {
  repoId: string;
  reasons: MatchReason[];
  primaryReason: MatchReason;
}

export interface RetrieveInput<T extends StarredRepoLike> {
  items: T[];
  filter: RepoFilter;
  sort: RepoSort;
  now?: number;
  collectionsByRepoId?: Map<string, string[]>;
  memoriesByRepoId?: Map<string, Memory>;
  /** repoId → 语义距离（越小越近）；缺省 / 空表示不做语义扩展。 */
  distanceByRepoId?: ReadonlyMap<string, number>;
  /** 语义近邻最多补充多少条；缺省表示不限。 */
  semanticLimit?: number;
}

export interface RetrieveResult<T extends StarredRepoLike> {
  /** 关键词 + 筛选命中（含仓库元数据与 Memory 意图），按所选维度排序。 */
  primary: T[];
  /** 未命中关键词但在语义向量空间相近的项，按距离升序排序。 */
  semantic: T[];
  /** repoId → MatchExplanation */
  explanations: Map<string, MatchExplanation>;
}

/** 从文本中截取包含搜索词的上下文摘要 */
export function extractSnippet(text: string, query: string, maxLength = 60): string {
  const trimmedText = text.trim();
  const lowerText = trimmedText.toLowerCase();
  const lowerQuery = query.trim().toLowerCase();
  if (!lowerQuery) {
    return trimmedText.length > maxLength
      ? `${trimmedText.slice(0, maxLength).trim()}...`
      : trimmedText;
  }
  const index = lowerText.indexOf(lowerQuery);
  if (index === -1) {
    return trimmedText.length > maxLength
      ? `${trimmedText.slice(0, maxLength).trim()}...`
      : trimmedText;
  }

  const queryLen = lowerQuery.length;
  const contextLen = Math.max(0, Math.floor((maxLength - queryLen) / 2));
  const start = Math.max(0, index - contextLen);
  const end = Math.min(trimmedText.length, index + queryLen + contextLen);

  let snippet = trimmedText.slice(start, end).trim();
  if (start > 0) {
    snippet = `...${snippet}`;
  }
  if (end < trimmedText.length) {
    snippet = `${snippet}...`;
  }
  return snippet;
}

/** 词法理由排序优先级：个人主观意图优先于客观元数据 */
const REASON_PRECEDENCE: Record<MatchReasonKind, number> = {
  why_saved: 1,
  note: 2,
  name: 3,
  description: 4,
  topic: 5,
  semantic_memory: 6,
  semantic_repo: 7,
};

function sortReasons(reasons: MatchReason[]): MatchReason[] {
  return [...reasons].sort(
    (a, b) => (REASON_PRECEDENCE[a.kind] ?? 99) - (REASON_PRECEDENCE[b.kind] ?? 99),
  );
}

/**
 * 统一检索引擎接口（GitHub #39 Unified Retrieval Engine）：
 * 整合客观仓库元数据（名称、描述、Topics）与用户私有 Memory（whySaved、note）的词法倒排与多路匹配，
 * 融合语义近邻推荐，产出结构化结果与可解释匹配理由（Match Explanation）。
 */
export function retrieveRepos<T extends StarredRepoLike>({
  items,
  filter,
  sort,
  now = Date.now(),
  collectionsByRepoId,
  memoriesByRepoId,
  distanceByRepoId,
  semanticLimit,
}: RetrieveInput<T>): RetrieveResult<T> {
  const query = filter.query?.trim().toLowerCase() ?? '';
  const explanations = new Map<string, MatchExplanation>();

  // 1. 先进行除 query 之外的客观属性与集合过滤
  const facetEligible = filterStarredRepos(
    items,
    { ...filter, query: '' },
    now,
    collectionsByRepoId,
  );

  // 2. 如果没有搜索词，返回按常规排序的结果，不附带解释
  if (!query) {
    return {
      primary: sortStarredRepos(facetEligible, sort),
      semantic: [],
      explanations,
    };
  }

  // 3. 多路词法匹配（仓库属性 + 用户个人 Memory）
  const keywordMatches: T[] = [];
  for (const item of facetEligible) {
    const { repo, repoId } = item;
    const memory = repoId ? memoriesByRepoId?.get(repoId) : undefined;
    const reasons: MatchReason[] = [];

    // 检查 Memory: why_saved
    const whySaved = memory?.whySaved?.trim();
    if (whySaved?.toLowerCase().includes(query)) {
      reasons.push({
        kind: 'why_saved',
        snippet: extractSnippet(whySaved, query),
        fullText: whySaved,
      });
    }

    // 检查 Memory: note
    const note = memory?.note?.trim();
    if (note?.toLowerCase().includes(query)) {
      reasons.push({
        kind: 'note',
        snippet: extractSnippet(note, query),
        fullText: note,
      });
    }

    // 检查 Repo: name / fullName / owner
    const nameMatch =
      repo.name.toLowerCase().includes(query) ||
      repo.fullName.toLowerCase().includes(query) ||
      repo.owner.toLowerCase().includes(query);
    if (nameMatch) {
      reasons.push({
        kind: 'name',
        snippet: repo.fullName,
        fullText: repo.fullName,
      });
    }

    // 检查 Repo: description
    const desc = repo.description?.trim();
    if (desc?.toLowerCase().includes(query)) {
      reasons.push({
        kind: 'description',
        snippet: extractSnippet(desc, query),
        fullText: desc,
      });
    }

    // 检查 Repo: topics
    const matchedTopic = repo.topics.find((topic) => topic.toLowerCase().includes(query));
    if (matchedTopic) {
      reasons.push({
        kind: 'topic',
        snippet: matchedTopic,
        fullText: matchedTopic,
        matchedField: matchedTopic,
      });
    }

    if (reasons.length > 0) {
      const sorted = sortReasons(reasons);
      const primaryReason = sorted[0] as MatchReason;
      if (repoId) {
        explanations.set(repoId, {
          repoId,
          reasons: sorted,
          primaryReason,
        });
      }
      keywordMatches.push(item);
    }
  }

  const primary = sortStarredRepos(keywordMatches, sort);

  // 4. 语义近邻扩展（Semantic Neighbors）
  if (!distanceByRepoId || distanceByRepoId.size === 0) {
    return { primary, semantic: [], explanations };
  }

  const matchedSet = new Set<T>(keywordMatches);
  const neighbors = facetEligible.filter((entry) => {
    if (matchedSet.has(entry)) {
      return false;
    }
    return entry.repoId != null && distanceByRepoId.has(entry.repoId);
  });

  neighbors.sort((a, b) => {
    const da = distanceByRepoId.get(a.repoId as string) as number;
    const db = distanceByRepoId.get(b.repoId as string) as number;
    return da !== db ? da - db : a.repo.fullName.localeCompare(b.repo.fullName);
  });

  const semantic = semanticLimit != null ? neighbors.slice(0, semanticLimit) : neighbors;

  // 为语义近邻赋予可解释性标签
  for (const item of semantic) {
    if (!item.repoId) {
      continue;
    }
    const memory = memoriesByRepoId?.get(item.repoId);
    const hasPersonalMemory = Boolean(memory?.whySaved?.trim() || memory?.note?.trim());
    const kind: MatchReasonKind = hasPersonalMemory ? 'semantic_memory' : 'semantic_repo';
    const targetText = hasPersonalMemory
      ? memory?.whySaved?.trim() || memory?.note?.trim()
      : item.repo.description?.trim() || undefined;
    const reason: MatchReason = {
      kind,
      snippet: targetText,
      fullText: targetText,
    };
    explanations.set(item.repoId, {
      repoId: item.repoId,
      reasons: [reason],
      primaryReason: reason,
    });
  }

  return { primary, semantic, explanations };
}
