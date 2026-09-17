// @vitest-environment happy-dom

import type { StarredRepoRecord } from '@asterism/db';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RepoInspectorProvider, useRepoInspector } from '../contexts/repo-inspector-context';
import i18n from '../i18n';
import { useRepoInspectorStore } from '../stores/repo-inspector';
import { RepoInspector } from './repo-inspector';

const semanticMocks = vi.hoisted(() => ({
  related: [
    {
      repoId: 'repo-2',
      repo: {
        owner: 'related',
        name: 'repository',
        description: 'A related repository from the same library.',
      },
      starredAt: null,
    },
  ],
}));

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

vi.mock('../data/use-semantic-neighborhood', () => ({
  useSemanticNeighborhood: () => semanticMocks.related,
}));

vi.mock('../hooks/use-media-query', () => ({
  // Floating Quick Look + reduced-motion (skip close animation).
  useMediaQuery: () => true,
}));

const record = {
  repoId: 'repo-1',
  repo: { owner: 'openai', name: 'codex' },
  starredAt: null,
} as StarredRepoRecord;

function Harness() {
  const controller = useRepoInspector();
  return (
    <div>
      <button
        type="button"
        data-testid="open"
        data-repo-quick-look-trigger={record.repoId}
        onClick={() =>
          controller.requestOpen(record, { sourceKey: 'browse', records: [record] }, 'pointer')
        }
      />
      <RepoInspector />
    </div>
  );
}

let container: HTMLDivElement;
let root: Root;

async function pointerDownOn(element: Element) {
  await act(async () => {
    element.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1 }),
    );
  });
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
}

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  useRepoInspectorStore.setState({ record: null, context: null });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <RepoInspectorProvider>
            <Harness />
          </RepoInspectorProvider>
        ),
      },
    ],
    { initialEntries: ['/'] },
  );
  await act(async () => {
    await i18n.changeLanguage('en');
    root.render(<RouterProvider router={router} />);
  });
  await act(async () => {
    container.querySelector<HTMLButtonElement>('[data-testid="open"]')?.click();
  });
  expect(document.getElementById('repo-inspector')).not.toBeNull();
});

afterEach(async () => {
  await act(async () => root.unmount());
  useRepoInspectorStore.setState({ record: null, context: null });
  container.remove();
});

describe('floating Quick Look overlay dismissal', () => {
  it('switches to a related star without leaving Quick Look', async () => {
    const related = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Open related repository related/repository"]',
    );
    expect(related).not.toBeNull();

    await act(async () => related?.click());

    expect(useRepoInspectorStore.getState().record?.repoId).toBe('repo-2');
    expect(document.getElementById('repo-inspector')).not.toBeNull();
  });

  it('does not close when pointerdown lands on a portaled menu', async () => {
    const menu = document.createElement('div');
    menu.setAttribute('role', 'menu');
    const item = document.createElement('div');
    item.setAttribute('role', 'menuitem');
    item.textContent = 'Create collection';
    menu.append(item);
    document.body.append(menu);

    await pointerDownOn(item);

    expect(document.getElementById('repo-inspector')).not.toBeNull();
    menu.remove();
  });

  it('does not close when pointerdown lands on a portaled dialog', async () => {
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.id = 'collection-form-dialog';
    const field = document.createElement('input');
    field.id = 'collection-name';
    dialog.append(field);
    document.body.append(dialog);

    await pointerDownOn(field);

    expect(document.getElementById('repo-inspector')).not.toBeNull();
    dialog.remove();
  });

  it('still closes on a true outside pointerdown', async () => {
    const outside = document.createElement('div');
    outside.textContent = 'outside';
    document.body.append(outside);

    await pointerDownOn(outside);

    expect(document.getElementById('repo-inspector')).toBeNull();
    outside.remove();
  });
});
