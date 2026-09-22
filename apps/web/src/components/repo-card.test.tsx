// @vitest-environment happy-dom

import type { StarredRepoRecord } from '@asterism/db';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../i18n';
import { RepoCard } from './repo-card';

const record: StarredRepoRecord = {
  repoId: 'repo-1',
  starredAt: null,
  repo: {
    githubId: 1,
    fullName: 'owner/repo',
    owner: 'owner',
    name: 'repo',
    description: 'Repository description',
    language: 'TypeScript',
    topics: [],
    stargazers: 42,
    forks: 3,
    homepage: null,
    pushedAt: null,
    repoCreatedAt: null,
    archived: false,
    isFork: false,
    syncedAt: '2026-07-20T00:00:00.000Z',
  },
};

class ResizeObserverMock {
  observe() {}
  disconnect() {}
}

let container: HTMLDivElement;
let root: Root;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  vi.unstubAllGlobals();
});

describe('RepoCard bulk selection', () => {
  it('identifies an unstarred repository without hiding its details', async () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () =>
      root.render(<RepoCard record={{ ...record, unstarredAt: '2026-09-22T00:00:00Z' }} />),
    );
    expect(container.textContent).toContain('No longer starred');
    expect(container.textContent).toContain('Repository description');
  });
  it('selects from the description while keeping only the repository name as a GitHub link', async () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    const onToggle = vi.fn();
    const onSelect = vi.fn();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () =>
      root.render(
        <RepoCard
          record={record}
          onSelect={onSelect}
          bulkSelection={{ repoIds: new Set(), onToggle }}
        />,
      ),
    );

    container.querySelector('p')?.click();

    expect(onToggle).toHaveBeenCalledWith(record.repoId);
    expect(onSelect).not.toHaveBeenCalled();

    const repoLink = container.querySelector<HTMLAnchorElement>(
      `a[href="https://github.com/${record.repo.fullName}"]`,
    );
    expect(repoLink?.textContent).toBe(record.repo.name);

    repoLink?.addEventListener('click', (event) => event.preventDefault(), { once: true });
    repoLink?.click();
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('renders match explanation when provided', async () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () =>
      root.render(
        <RepoCard
          record={record}
          explanation={{
            repoId: record.repoId,
            primaryReason: { kind: 'why_saved', snippet: '替换微服务网关' },
            reasons: [{ kind: 'why_saved', snippet: '替换微服务网关' }],
          }}
        />,
      ),
    );

    expect(container.textContent).toContain('替换微服务网关');
  });

  it('hides match explanations in bulk selection mode', async () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () =>
      root.render(
        <RepoCard
          record={record}
          explanation={{
            repoId: record.repoId,
            primaryReason: { kind: 'why_saved', snippet: '替换微服务网关' },
            reasons: [{ kind: 'why_saved', snippet: '替换微服务网关' }],
          }}
          bulkSelection={{ repoIds: new Set(), onToggle: vi.fn() }}
        />,
      ),
    );

    expect(container.textContent).not.toContain('替换微服务网关');
  });
});
