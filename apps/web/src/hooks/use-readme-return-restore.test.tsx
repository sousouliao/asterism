// @vitest-environment happy-dom

import type { StarredRepoRecord } from '@asterism/db';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RepoInspectorProvider, useRepoInspector } from '../contexts/repo-inspector-context';
import { createBrowseSourceSnapshot, createReadmeDestination } from '../lib/readme-navigation';
import {
  armReadmeReturn,
  clearReadmeReturnState,
  prepareReadmeReturn,
} from '../lib/readme-return-coordinator';
import { useBrowseFilters } from '../stores/browse-filters';
import { getBrowseView, useBrowseViewStore } from '../stores/browse-view';
import { useRepoInspectorStore } from '../stores/repo-inspector';
import { useReadmeReturnRestore } from './use-readme-return-restore';

vi.mock('../data/use-memory', () => ({
  useMemory: () => ({ data: null, isLoading: false }),
  useSaveMemory: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('../data/use-collections', () => ({
  useCollections: () => ({ data: [] }),
}));

vi.mock('../data/use-collection-repos', () => ({
  useCollectionRepos: () => ({ data: [] }),
  useToggleCollectionRepo: () => ({ mutate: vi.fn() }),
}));

vi.mock('../hooks/use-media-query', () => ({
  useMediaQuery: () => true,
}));

const record = {
  repoId: 'repo-1',
  repo: { owner: 'openai', name: 'codex', fullName: 'openai/codex' },
  starredAt: '2026-01-01T00:00:00Z',
} as StarredRepoRecord;

function BrowseHarness({
  records,
  ready = true,
  attachScroll = true,
}: {
  records: StarredRepoRecord[];
  ready?: boolean;
  attachScroll?: boolean;
}) {
  const { requestOpen } = useRepoInspector();
  const selected = useRepoInspectorStore((state) => state.record?.repoId);
  const query = useBrowseFilters((state) => state.query);
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);
  const inspectorContext = { sourceKey: 'browse' as const, records };

  useReadmeReturnRestore({
    sourceKey: 'browse',
    records,
    scrollElement: attachScroll ? scrollElement : null,
    inspectorContext,
    requestOpen,
    ready,
  });

  return (
    <div>
      <span data-testid="selected">{selected ?? ''}</span>
      <span data-testid="query">{query}</span>
      <span data-testid="view">{getBrowseView()}</span>
      {attachScroll ? (
        <div
          data-scroll
          ref={(node) => {
            if (node) {
              Object.defineProperty(node, 'scrollTop', {
                configurable: true,
                get: () => (node as HTMLDivElement & { _scrollTop?: number })._scrollTop ?? 0,
                set: (value: number) => {
                  (node as HTMLDivElement & { _scrollTop?: number })._scrollTop = value;
                },
              });
            }
            setScrollElement(node);
          }}
        />
      ) : null}
    </div>
  );
}

function browseSnapshot(overrides: Partial<Parameters<typeof createBrowseSourceSnapshot>[0]> = {}) {
  return createBrowseSourceSnapshot(
    {
      query: 'codex',
      language: 'TypeScript',
      topic: null,
      collectionIds: [],
      minStars: 0,
      pushedWithinDays: null,
      status: 'all',
      sort: 'name',
      ...overrides,
    },
    'list',
    240,
  );
}

function CollectionHarness({
  records,
  collectionId = 'collection-7',
}: {
  records: StarredRepoRecord[];
  collectionId?: string;
}) {
  const { requestOpen } = useRepoInspector();
  const selected = useRepoInspectorStore((state) => state.record?.repoId);
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);
  const sourceKey = `collection:${collectionId}`;
  const inspectorContext = { sourceKey, sourceName: 'AI tools', records };

  useReadmeReturnRestore({
    sourceKey,
    records,
    scrollElement,
    inspectorContext,
    requestOpen,
    ready: true,
  });

  return (
    <div>
      <span data-testid="selected">{selected ?? ''}</span>
      <div
        data-scroll
        ref={(node) => {
          if (node) {
            Object.defineProperty(node, 'scrollTop', {
              configurable: true,
              get: () => (node as HTMLDivElement & { _scrollTop?: number })._scrollTop ?? 0,
              set: (value: number) => {
                (node as HTMLDivElement & { _scrollTop?: number })._scrollTop = value;
              },
            });
          }
          setScrollElement(node);
        }}
      />
    </div>
  );
}

async function renderBrowse(
  records: StarredRepoRecord[],
  options?: { ready?: boolean; attachScroll?: boolean },
) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <RepoInspectorProvider>
            <BrowseHarness
              records={records}
              ready={options?.ready}
              attachScroll={options?.attachScroll}
            />
          </RepoInspectorProvider>
        ),
      },
    ],
    { initialEntries: ['/'] },
  );
  await act(async () => root.render(<RouterProvider router={router} />));
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  return router;
}

async function renderCollection(records: StarredRepoRecord[], collectionId = 'collection-7') {
  const router = createMemoryRouter(
    [
      {
        path: `/collections/${collectionId}`,
        element: (
          <RepoInspectorProvider>
            <CollectionHarness records={records} collectionId={collectionId} />
          </RepoInspectorProvider>
        ),
      },
    ],
    { initialEntries: [`/collections/${collectionId}`] },
  );
  await act(async () => root.render(<RouterProvider router={router} />));
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  return router;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  clearReadmeReturnState();
  useBrowseFilters.getState().reset();
  useBrowseViewStore.setState({ view: 'grid' });
  useRepoInspectorStore.setState({ record: null, context: null });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  clearReadmeReturnState();
  useBrowseFilters.getState().reset();
  useBrowseViewStore.setState({ view: 'grid' });
  useRepoInspectorStore.setState({ record: null, context: null });
  container.remove();
});

describe('README return restore on Browse', () => {
  it('restores filters/view and reopens Quick Look when the repository is still visible', async () => {
    const state = createReadmeDestination('openai', 'codex', 'repo-1', '/', {
      browseSnapshot: browseSnapshot(),
    }).state;

    prepareReadmeReturn({ state, owner: 'openai', name: 'codex' });
    await renderBrowse([record]);

    expect(container.querySelector('[data-testid="query"]')?.textContent).toBe('codex');
    expect(container.querySelector('[data-testid="view"]')?.textContent).toBe('list');
    expect(container.querySelector('[data-testid="selected"]')?.textContent).toBe('repo-1');
    expect(document.querySelector<HTMLElement>('[data-scroll]')?.scrollTop).toBe(240);
  });

  it('keeps pending across an early not-ready pass and remount so Quick Look still reopens', async () => {
    const state = createReadmeDestination('openai', 'codex', 'repo-1', '/', {
      browseSnapshot: browseSnapshot(),
    }).state;

    prepareReadmeReturn({ state, owner: 'openai', name: 'codex' });
    await renderBrowse([record], { ready: false, attachScroll: false });
    expect(container.querySelector('[data-testid="selected"]')?.textContent).toBe('');

    await act(async () => root.unmount());
    root = createRoot(container);
    useRepoInspectorStore.setState({ record: null, context: null });
    await renderBrowse([record], { ready: true, attachScroll: true });

    expect(container.querySelector('[data-testid="selected"]')?.textContent).toBe('repo-1');
    expect(document.querySelector<HTMLElement>('[data-scroll]')?.scrollTop).toBe(240);
  });

  it('skips reopen and forced scroll when the repository is no longer visible', async () => {
    const state = createReadmeDestination('openai', 'codex', 'repo-1', '/', {
      browseSnapshot: browseSnapshot({ query: 'missing', language: null, sort: 'starred' }),
    }).state;

    prepareReadmeReturn({ state, owner: 'openai', name: 'codex' });
    await renderBrowse([]);

    expect(container.querySelector('[data-testid="query"]')?.textContent).toBe('missing');
    expect(container.querySelector('[data-testid="selected"]')?.textContent).toBe('');
    expect(document.querySelector<HTMLElement>('[data-scroll]')?.scrollTop ?? 0).toBe(0);
  });
});

describe('README return restore on Collection', () => {
  it('reopens Quick Look when pending is armed after the page has already mounted', async () => {
    await renderCollection([record]);
    expect(container.querySelector('[data-testid="selected"]')?.textContent).toBe('');

    await act(async () => {
      armReadmeReturn({
        to: '/collections/collection-7',
        source: 'collection',
        collectionName: 'AI tools',
        restoreBrowse: null,
        reopenRepoId: 'repo-1',
        scrollTop: 90,
      });
    });
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

    expect(container.querySelector('[data-testid="selected"]')?.textContent).toBe('repo-1');
    expect(document.querySelector<HTMLElement>('[data-scroll]')?.scrollTop).toBe(90);
  });
});
