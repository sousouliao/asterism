import type { Memory } from '@asterism/core';
import { createContext, type ReactNode, use, useMemo } from 'react';
import { useEmbeddingBootstrap } from '../data/use-embedding-bootstrap';
import { useMemoriesList } from '../data/use-memories-list';
import { useStarredRepos } from '../data/use-starred-repos';

type EmbeddingBootstrapContextValue = ReturnType<typeof useEmbeddingBootstrap> & {
  repositoryCount: number;
};

const EmbeddingBootstrapContext = createContext<EmbeddingBootstrapContextValue | null>(null);

export function EmbeddingBootstrapProvider({ children }: { children: ReactNode }) {
  const { data } = useStarredRepos();
  const records = useMemo(() => data ?? [], [data]);
  const { data: memoriesList } = useMemoriesList();
  const memoriesByRepoId = useMemo(() => {
    const map = new Map<string, Memory>();
    for (const item of memoriesList ?? []) {
      map.set(item.repoId, item);
    }
    return map;
  }, [memoriesList]);

  const bootstrap = useEmbeddingBootstrap(records, memoriesByRepoId);
  const value = useMemo(
    () => ({ ...bootstrap, repositoryCount: records.length }),
    [bootstrap, records.length],
  );

  return (
    <EmbeddingBootstrapContext.Provider value={value}>
      {children}
    </EmbeddingBootstrapContext.Provider>
  );
}

export function useEmbeddingBootstrapContext() {
  const value = use(EmbeddingBootstrapContext);
  if (!value) {
    throw new Error('useEmbeddingBootstrapContext must be used within EmbeddingBootstrapProvider');
  }
  return value;
}
