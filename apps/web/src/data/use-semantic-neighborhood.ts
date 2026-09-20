import {
  buildSemanticNeighborhoodIndex,
  DEFAULT_EMBEDDING_MODEL,
  type EmbeddableRepo,
  findKeywordFallbackNeighbors,
  findMutualSemanticNeighbors,
  type Memory,
  repoContentHash,
  type SemanticNeighborhoodIndex,
} from '@asterism/core';
import { listRepoEmbeddings, type RepoEmbeddingRecord, type StarredRepoRecord } from '@asterism/db';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useSession } from '../auth/use-session';
import { useEmbeddingAvailability } from '../lib/embedding-consent';
import { supabase } from '../lib/supabase';
import { embeddingKeys } from './keys';
import { useMemoriesList } from './use-memories-list';
import { useStarredRepos } from './use-starred-repos';

function toEmbeddableRepo(record: StarredRepoRecord, memory?: Memory): EmbeddableRepo {
  return {
    fullName: record.repo.fullName,
    description: record.repo.description,
    topics: record.repo.topics,
    whySaved: memory?.whySaved,
    note: memory?.note,
  };
}

export function selectSemanticNeighborhood(
  anchorRepoId: string,
  starredRepos: readonly StarredRepoRecord[],
  embeddings: readonly RepoEmbeddingRecord[],
  memoriesByRepoId?: Map<string, Memory>,
): StarredRepoRecord[] {
  const freshVectors = selectFreshRepoEmbeddingVectors(starredRepos, embeddings, memoriesByRepoId);
  const repoById = new Map(starredRepos.map((record) => [record.repoId, record]));
  return resolveSemanticNeighbors(
    buildSemanticNeighborhoodIndex(
      freshVectors.map((record) => ({ repoId: record.repoId, embedding: record.vector })),
    ),
    anchorRepoId,
    repoById,
  );
}

function resolveSemanticNeighbors(
  index: SemanticNeighborhoodIndex,
  anchorRepoId: string,
  repoById: Map<string, StarredRepoRecord>,
): StarredRepoRecord[] {
  return findMutualSemanticNeighbors(index, anchorRepoId)
    .map((neighbor) => repoById.get(neighbor.repoId))
    .filter((record): record is StarredRepoRecord => Boolean(record));
}

type FreshRepoEmbedding = { repoId: string; vector: readonly number[] };

export function selectFreshRepoEmbeddingVectors(
  starredRepos: readonly StarredRepoRecord[],
  embeddings: readonly RepoEmbeddingRecord[],
  memoriesByRepoId?: Map<string, Memory>,
): FreshRepoEmbedding[] {
  const repoById = new Map(starredRepos.map((record) => [record.repoId, record]));
  return embeddings.flatMap((record) => {
    const starred = repoById.get(record.repoId);
    if (!starred) {
      return [];
    }
    const memory = memoriesByRepoId?.get(record.repoId);
    const embeddable = toEmbeddableRepo(starred, memory);
    const fresh =
      record.embeddingModel === DEFAULT_EMBEDDING_MODEL &&
      record.contentHash === repoContentHash(embeddable);
    return fresh ? [{ repoId: record.repoId, vector: record.embedding }] : [];
  });
}

export function useSemanticNeighborhood(anchorRepoId: string | undefined): StarredRepoRecord[] {
  const { session } = useSession();
  const userId = session?.user.id;
  const availability = useEmbeddingAvailability(userId);
  const { data: starredRepos } = useStarredRepos();
  const { data: memoriesList } = useMemoriesList({ enabled: Boolean(userId) });
  const memoriesByRepoId = useMemo(() => {
    const map = new Map<string, Memory>();
    for (const item of memoriesList ?? []) {
      map.set(item.repoId, item);
    }
    return map;
  }, [memoriesList]);

  const { data: embeddings, isError: embeddingsError } = useQuery({
    queryKey: embeddingKeys.list(userId ?? 'anon'),
    enabled: Boolean(userId && anchorRepoId && availability === 'available'),
    staleTime: 10 * 60 * 1_000,
    queryFn: () => (userId ? listRepoEmbeddings(supabase, userId) : Promise.resolve([])),
  });

  const repoById = useMemo(
    () => new Map((starredRepos ?? []).map((record) => [record.repoId, record])),
    [starredRepos],
  );

  // 索引只依赖数据集本身：切换 Quick Look 的锚点不再重算归一化与全量扫描。
  const index = useMemo(() => {
    if (!starredRepos || !embeddings || availability !== 'available') {
      return null;
    }
    return buildSemanticNeighborhoodIndex(
      selectFreshRepoEmbeddingVectors(starredRepos, embeddings, memoriesByRepoId).map((record) => ({
        repoId: record.repoId,
        embedding: record.vector,
      })),
    );
  }, [availability, embeddings, memoriesByRepoId, starredRepos]);

  return useMemo(() => {
    if (!anchorRepoId || !starredRepos) {
      return [];
    }

    const keywordFallback = (): StarredRepoRecord[] => {
      const anchor = repoById.get(anchorRepoId);
      if (!anchor) {
        return [];
      }
      return findKeywordFallbackNeighbors({
        anchorRepoId,
        anchorRepo: anchor.repo,
        items: starredRepos,
        memoriesByRepoId,
      })
        .map((item) => repoById.get(item.repoId))
        .filter((record): record is StarredRepoRecord => Boolean(record));
    };

    // 向量运行时不可用或向量读取失败时，使用可信的本地元数据 / Memory 降级。
    if (availability === 'degraded' || embeddingsError) {
      return keywordFallback();
    }
    if (!index) {
      return [];
    }

    const semanticNeighbors = resolveSemanticNeighbors(index, anchorRepoId, repoById);
    // 向量库就绪但该仓库在向量空间互为近邻为空时，回落到 Memory 意图与 Topics。
    return semanticNeighbors.length > 0 ? semanticNeighbors : keywordFallback();
  }, [
    anchorRepoId,
    availability,
    embeddingsError,
    index,
    memoriesByRepoId,
    repoById,
    starredRepos,
  ]);
}
