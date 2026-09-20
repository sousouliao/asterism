import type { CollectionRepoLink } from '@asterism/db';

export function countCollectionsByRepo(links: readonly CollectionRepoLink[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const link of links) {
    counts.set(link.repoId, (counts.get(link.repoId) ?? 0) + 1);
  }
  return counts;
}
