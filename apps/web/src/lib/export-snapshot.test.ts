import type { Repo } from '@asterism/core';
import type { CollectionRepoLink, CollectionWithMeta, StarredRepoRecord } from '@asterism/db';
import { describe, expect, it } from 'vitest';
import {
  buildExportSnapshot,
  buildSelectedExportSnapshot,
  type ExportSourceData,
} from './export-snapshot';

function repo(fullName: string): Repo {
  const [owner, name] = fullName.split('/');
  return {
    githubId: fullName.length,
    fullName,
    name: name ?? fullName,
    owner: owner ?? fullName,
    description: `${fullName} description`,
    language: 'TypeScript',
    topics: ['topic'],
    stargazers: 10,
    forks: 2,
    homepage: null,
    pushedAt: '2024-06-01T00:00:00Z',
    repoCreatedAt: '2020-01-01T00:00:00Z',
    archived: false,
    isFork: false,
    syncedAt: '2024-06-02T00:00:00Z',
  };
}

function record(repoId: string, fullName: string): StarredRepoRecord {
  return { repoId, repo: repo(fullName), starredAt: '2024-01-01T00:00:00Z' };
}

const collections: CollectionWithMeta[] = [
  { id: 'col-web', name: 'Web', description: 'Web stack', repoCount: 1, updatedAt: '2024-01-01' },
  { id: 'col-infra', name: 'Infra', description: null, repoCount: 1, updatedAt: '2024-01-01' },
];

const collectionRepos: CollectionRepoLink[] = [
  { collectionId: 'col-web', repoId: 'r1' },
  { collectionId: 'col-infra', repoId: 'r2' },
];

const source: ExportSourceData = {
  starredRepos: [record('r1', 'vercel/next.js'), record('r2', 'denoland/deno')],
  collections,
  collectionRepos,
  memories: [
    {
      repoId: 'r1',
      source: 'github_star',
      sourceCreatedAt: '2024-01-01T00:00:00Z',
      whySaved: 'React framework research',
      note: 'Great docs',
    },
    {
      repoId: 'r2',
      source: 'github_star',
      sourceCreatedAt: '2024-02-01T00:00:00Z',
      whySaved: null,
      note: 'Rust runtime',
    },
    {
      repoId: 'ghost',
      source: 'github_star',
      sourceCreatedAt: null,
      whySaved: 'orphan context',
      note: null,
    },
  ],
};

describe('buildExportSnapshot', () => {
  it('maps repository-id-keyed source data to a full-name-keyed snapshot', () => {
    const snapshot = buildExportSnapshot(source);

    expect(snapshot.repos.map((r) => r.fullName)).toEqual(['vercel/next.js', 'denoland/deno']);
    expect(snapshot.collectionRepos).toEqual([
      { collectionName: 'Web', fullName: 'vercel/next.js' },
      { collectionName: 'Infra', fullName: 'denoland/deno' },
    ]);
    expect(snapshot.memories.map((memory) => memory.fullName)).toEqual([
      'vercel/next.js',
      'denoland/deno',
    ]);
  });

  it('drops Memories and links that reference repositories outside the library', () => {
    const snapshot = buildExportSnapshot(source);

    expect(snapshot.memories.some((memory) => memory.whySaved === 'orphan context')).toBe(false);
  });
});

describe('buildSelectedExportSnapshot', () => {
  it('keeps only the fixed repository-id scope and its relevant organization data', () => {
    const snapshot = buildSelectedExportSnapshot(source, new Set(['r1']));

    expect(snapshot.repos.map((r) => r.fullName)).toEqual(['vercel/next.js']);
    expect(snapshot.collections).toEqual([{ name: 'Web', description: 'Web stack' }]);
    expect(snapshot.collectionRepos).toEqual([
      { collectionName: 'Web', fullName: 'vercel/next.js' },
    ]);
    expect(snapshot.memories).toEqual([
      {
        fullName: 'vercel/next.js',
        source: 'github_star',
        sourceCreatedAt: '2024-01-01T00:00:00Z',
        whySaved: 'React framework research',
        note: 'Great docs',
      },
    ]);
  });

  it('returns an empty snapshot when the scope is empty', () => {
    const snapshot = buildSelectedExportSnapshot(source, new Set());

    expect(snapshot.repos).toEqual([]);
    expect(snapshot.collections).toEqual([]);
  });

  it('ignores repository ids that are not in the library', () => {
    const snapshot = buildSelectedExportSnapshot(source, new Set(['r2', 'missing']));

    expect(snapshot.repos.map((r) => r.fullName)).toEqual(['denoland/deno']);
  });
});
