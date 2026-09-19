import { toQueryInput } from '@asterism/core';
import { searchRepoEmbeddings } from '@asterism/db';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useSession } from '../auth/use-session';
import { supabase } from '../lib/supabase';
import { embeddingKeys } from './keys';

/** 语义近邻最多补充多少条（与 core 的 semanticLimit 对齐）。 */
export const SEMANTIC_MATCH_COUNT = 24;
/** 打字实时重排的节流：query 稳定这么久才嵌入 + 检索，避免每键一次 embed。 */
export const QUERY_DEBOUNCE_MS = 180;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export interface SemanticNeighborsResult {
  /** repoId → 语义距离（越小越近）；喂给 core 的 rankHybridRepos。 */
  distanceByRepoId: Map<string, number>;
  /** 正在嵌入 / 检索（供 UI 表达「结果还在浮现」）。 */
  isSearching: boolean;
}

/**
 * 「隐形混合搜索」的浏览器侧：把查询文本在本地嵌成向量，仅向量上送 RLS-safe RPC 取近邻。
 * 仅在 `enabled`（模型已就绪 + 本人有向量）且有查询词时触发；否则返回空图，
 * 由 core 的 rankHybridRepos 自然退化为纯关键词排序（ADR 0026 §3/§7）。
 */
export function useSemanticNeighbors(
  query: string,
  options: { enabled: boolean },
): SemanticNeighborsResult {
  const { session } = useSession();
  const userId = session?.user.id;
  const trimmed = query.trim();
  const debouncedQuery = useDebouncedValue(trimmed, QUERY_DEBOUNCE_MS);
  const enabled = options.enabled && Boolean(userId) && debouncedQuery.length > 0;
  // 防抖窗口内 fetch 尚未派发，但对等待方而言结果同样「还在浮现」；
  // 只看 isFetching 会让调用方（Ask 编排）在这段窗口误判检索已完成而绕过语义通道。
  const debouncePending =
    options.enabled && Boolean(userId) && trimmed.length > 0 && debouncedQuery !== trimmed;

  const { data, isFetching } = useQuery({
    queryKey: embeddingKeys.search(userId ?? 'anon', debouncedQuery),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1_000,
    queryFn: async () => {
      // 与 use-embedding-bootstrap 一致的懒加载：让重型 runtime（Worker + wasm）留在按需 chunk。
      const { getEmbeddingRuntime } = await import('../lib/embedding-runtime');
      const [vector] = await getEmbeddingRuntime().embed([toQueryInput(debouncedQuery)]);
      if (!vector) {
        return [];
      }
      return searchRepoEmbeddings(supabase, {
        queryEmbedding: vector,
        matchCount: SEMANTIC_MATCH_COUNT,
      });
    },
  });

  const distanceByRepoId = useMemo(() => {
    const map = new Map<string, number>();
    if (enabled) {
      for (const neighbor of data ?? []) {
        map.set(neighbor.repoId, neighbor.distance);
      }
    }
    return map;
  }, [data, enabled]);

  return { distanceByRepoId, isSearching: (enabled && isFetching) || debouncePending };
}
