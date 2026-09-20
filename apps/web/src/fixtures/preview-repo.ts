import type { Repo } from '@asterism/core';

/** dev-only 预览页共用的仓库 fixture 工厂，避免每个预览页各自维护一份默认值。 */
export function previewRepo(overrides: Partial<Repo>): Repo {
  return {
    githubId: 1,
    fullName: 'owner/name',
    name: 'name',
    owner: 'owner',
    description: 'Fixture repository for dev previews',
    language: 'TypeScript',
    topics: ['preview'],
    stargazers: 500,
    forks: 12,
    homepage: null,
    pushedAt: null,
    repoCreatedAt: null,
    archived: false,
    isFork: false,
    syncedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}
