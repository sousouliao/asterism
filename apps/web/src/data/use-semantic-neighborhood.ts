import {
  DEFAULT_EMBEDDING_MODEL,
  findMutualSemanticNeighbors,
  repoContentHash,
} from '@asterism/core';
import { listRepoEmbeddings, type RepoEmbeddingRecord, type StarredRepoRecord } from '@asterism/db';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useSession } from '../auth/use-session';
import { useEmbeddingAvailability } from '../lib/embedding-consent';
import { supabase } from '../lib/supabase';
import { embeddingKeys } from './keys';
import { useStarredRepos } from './use-starred-repos';

export function selectSemanticNeighborhood(
  anchorRepoId: string,
  starredRepos: readonly StarredRepoRecord[],
  embeddings: readonly RepoEmbeddingRecord[],
): StarredRepoRecord[] {
  const freshVectors = selectFreshRepoEmbeddingVectors(starredRepos, embeddings);
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
): FreshRepoEmbedding[] {
  const repoById = new Map(starredRepos.map((record) => [record.repoId, record]));
  return embeddings.flatMap((record) => {
    const starred = repoById.get(record.repoId);
    const fresh =
      starred &&
      record.embeddingModel === DEFAULT_EMBEDDING_MODEL &&
      record.contentHash === repoContentHash(starred.repo);
    return fresh ? [{ repoId: record.repoId, vector: [...record.embedding] }] : [];
  });
}

export function useSemanticNeighborhood(anchorRepoId: string | undefined): StarredRepoRecord[] {
  const { session } = useSession();
  const userId = session?.user.id;
  const availability = useEmbeddingAvailability(userId);
  const { data: starredRepos } = useStarredRepos();
  const { data: embeddings } = useQuery({
    queryKey: embeddingKeys.list(userId ?? 'anon'),
    enabled: Boolean(userId && anchorRepoId && availability === 'available'),
    staleTime: 10 * 60 * 1_000,
    queryFn: () => (userId ? listRepoEmbeddings(supabase, userId) : Promise.resolve([])),
  });

  return useMemo(() => {
    if (availability !== 'available' || !(anchorRepoId && embeddings && starredRepos)) {
      return [];
    }
    return selectSemanticNeighborhood(anchorRepoId, starredRepos, embeddings);
  }, [anchorRepoId, availability, embeddings, starredRepos]);
}
