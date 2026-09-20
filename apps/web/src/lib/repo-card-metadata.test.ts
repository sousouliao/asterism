import type { CollectionRepoLink } from '@asterism/db';
import { describe, expect, it } from 'vitest';
import { countCollectionsByRepo } from './repo-card-metadata';

describe('repo card metadata', () => {
  it('counts collection memberships by repository', () => {
    const links: CollectionRepoLink[] = [
      { collectionId: 'a', repoId: 'repo-1' },
      { collectionId: 'b', repoId: 'repo-1' },
      { collectionId: 'a', repoId: 'repo-2' },
    ];

    expect([...countCollectionsByRepo(links)]).toEqual([
      ['repo-1', 2],
      ['repo-2', 1],
    ]);
  });
});
