import {
  DEFAULT_EMBEDDING_MODEL,
  type EmbeddableRepo,
  findKeywordFallbackNeighbors,
  findMutualSemanticNeighbors,
  type Memory,
  repoContentHash,
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
  return findMutualSemanticNeighbors(
    freshVectors.map((record) => ({ repoId: record.repoId, embedding: record.vector })),
    anchorRepoId,
  )
    .map((neighbor) => repoById.get(neighbor.repoId))
    .filter((record): record is StarredRepoRecord => Boolean(record));
}

type FreshRepoEmbedding = { repoId: string; vector: number[] };

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
    return fresh ? [{ repoId: record.repoId, vector: [...record.embedding] }] : [];
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

  return useMemo(() => {
    if (!anchorRepoId || !starredRepos) {
      return [];
    }
    // 向量运行时不可用或向量读取失败时，使用可信的本地元数据 / Memory 降级。
    if (availability === 'degraded' || embeddingsError) {
      const repoById = new Map(starredRepos.map((record) => [record.repoId, record]));
      const anchor = repoById.get(anchorRepoId);
      if (!anchor) {
        return [];
      }
      const fallback = findKeywordFallbackNeighbors({
        anchorRepoId,
        anchorRepo: anchor.repo,
        items: starredRepos,
        memoriesByRepoId,
      });
      return fallback
        .map((item) => repoById.get(item.repoId))
        .filter((record): record is StarredRepoRecord => Boolean(record));
    }

    if (availability !== 'available' || !embeddings) {
      return [];
    }

    const semanticNeighbors = selectSemanticNeighborhood(
      anchorRepoId,
      starredRepos,
      embeddings,
      memoriesByRepoId,
    );
    if (semanticNeighbors.length > 0) {
      return semanticNeighbors;
    }

    // 向量库就绪但该仓库在向量空间互为近邻为空时，提供基于 Memory 意图与 Topics 的降级候补
    const repoById = new Map(starredRepos.map((record) => [record.repoId, record]));
    const anchor = repoById.get(anchorRepoId);
    if (!anchor) {
      return [];
    }
    const fallback = findKeywordFallbackNeighbors({
      anchorRepoId,
      anchorRepo: anchor.repo,
      items: starredRepos,
      memoriesByRepoId,
    });
    return fallback
      .map((item) => repoById.get(item.repoId))
      .filter((record): record is StarredRepoRecord => Boolean(record));
  }, [anchorRepoId, availability, embeddings, embeddingsError, memoriesByRepoId, starredRepos]);
}
