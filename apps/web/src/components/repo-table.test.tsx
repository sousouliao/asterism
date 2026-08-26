// @vitest-environment happy-dom

import type { StarredRepoRecord } from '@asterism/db';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../i18n';
import { RepoTableRow } from './repo-table';

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
    syncedAt: '2026-07-19T00:00:00.000Z',
  },
};

let container: HTMLDivElement;
let root: Root;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
});

describe('RepoTableRow bulk selection', () => {
  it('anchors the absolute selection marker to its own row', async () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () =>
      root.render(
        <table>
          <tbody>
            <RepoTableRow
              record={record}
              layout="wide"
              rowIndex={2}
              measureElement={vi.fn()}
              bulkSelection={{ repoIds: new Set(), onToggle: vi.fn() }}
            />
          </tbody>
        </table>,
      ),
    );

    const row = container.querySelector('tr');
    const marker = container.querySelector('td[aria-hidden="true"]');

    expect(marker?.classList.contains('absolute')).toBe(true);
    expect(row?.classList.contains('relative')).toBe(true);
  });

  it('uses a quiet surface without an inset ring for bulk-selected rows', async () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () =>
      root.render(
        <table>
          <tbody>
            <RepoTableRow
              record={record}
              selected
              layout="wide"
              rowIndex={2}
              measureElement={vi.fn()}
              bulkSelection={{ repoIds: new Set([record.repoId]), onToggle: vi.fn() }}
            />
          </tbody>
        </table>,
      ),
    );

    const row = container.querySelector('tr');

    expect(row?.classList.contains('bg-accent/30')).toBe(true);
    expect(row?.className).not.toContain('shadow-[inset_0_0_0_1px_var(--ring)]');
  });

  it('keeps the inset ring for the single Quick Look selection', async () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () =>
      root.render(
        <table>
          <tbody>
            <RepoTableRow
              record={record}
              selected
              layout="wide"
              rowIndex={2}
              measureElement={vi.fn()}
            />
          </tbody>
        </table>,
      ),
    );

    expect(container.querySelector('tr')?.className).toContain(
      'shadow-[inset_0_0_0_1px_var(--ring)]',
    );
  });
});
