import {
  type MatchExplanation,
  type Memory,
  type RepoFilter,
  type RepoSort,
  retrieveRepos,
} from '@asterism/core';
import type { StarredRepoRecord } from '@asterism/db';
import { useMemo } from 'react';
import { SEMANTIC_MATCH_COUNT, useSemanticNeighbors } from './use-semantic-search';

export interface UseUnifiedRetrievalInput {
  records: readonly StarredRepoRecord[];
  filter: RepoFilter;
  sort: RepoSort;
  collectionsByRepoId?: Map<string, string[]>;
  memoriesByRepoId?: Map<string, Memory>;
  semanticEnabled: boolean;
}

export interface UnifiedRetrievalResult {
  primary: StarredRepoRecord[];
  semantic: StarredRepoRecord[];
  visible: StarredRepoRecord[];
  explanations: Map<string, MatchExplanation>;
  semanticStartIndex: number | null;
  isSearching: boolean;
}

/**
 * 统一检索引擎前端 Hook（GitHub #39）：
 * 整合用户私有 Memory（whySaved、note）与仓库客观属性的词法倒排与语义近邻，
 * 输出主命中列表、语义扩展列表、综合可见列表以及可解释性原因（MatchExplanation）。
 */
export function useUnifiedRetrieval({
  records,
  filter,
  sort,
  collectionsByRepoId,
  memoriesByRepoId,
  semanticEnabled,
}: UseUnifiedRetrievalInput): UnifiedRetrievalResult {
  const query = filter.query?.trim() ?? '';
  const { distanceByRepoId, isSearching } = useSemanticNeighbors(query, {
    enabled: semanticEnabled,
  });

  const retrieval = useMemo(
    () =>
      retrieveRepos({
        items: records as StarredRepoRecord[],
        filter,
        sort,
        now: Date.now(),
        collectionsByRepoId,
        memoriesByRepoId,
        distanceByRepoId,
        semanticLimit: SEMANTIC_MATCH_COUNT,
      }),
    [records, filter, sort, collectionsByRepoId, memoriesByRepoId, distanceByRepoId],
  );

  const primary = retrieval.primary;
  const semantic = retrieval.semantic;
  const explanations = retrieval.explanations;
  const visible = useMemo(() => [...primary, ...semantic], [primary, semantic]);
  const semanticStartIndex = semantic.length > 0 ? primary.length : null;

  return {
    primary,
    semantic,
    visible,
    explanations,
    semanticStartIndex,
    isSearching,
  };
}
