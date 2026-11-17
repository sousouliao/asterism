// @vitest-environment happy-dom

import type { StarredRepoRecord } from '@asterism/db';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RepoInspector } from '../components/repo-inspector';
import i18n from '../i18n';
import { useRepoInspectorStore } from '../stores/repo-inspector';
import { RepoInspectorProvider, useRepoInspector } from './repo-inspector-context';

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  memory: {
    repoId: 'repo-1',
    source: 'github_star' as const,
    sourceCreatedAt: null,
    whySaved: 'saved reason',
    note: 'saved note',
  },
}));

vi.mock('../data/use-memory', () => ({
  useMemory: () => ({ data: mocks.memory, isLoading: false }),
  useSaveMemory: () => ({ mutateAsync: mocks.mutateAsync, isPending: false }),
}));

vi.mock('../data/use-collections', () => ({
  useCollections: () => ({ data: [] }),
}));

vi.mock('../data/use-collection-repos', () => ({
  useCollectionRepos: () => ({ data: [] }),
  useToggleCollectionRepo: () => ({ mutate: vi.fn() }),
}));

vi.mock('../data/use-semantic-neighborhood', () => ({
  useSemanticNeighborhood: () => [],
}));

vi.mock('../hooks/use-media-query', () => ({
  useMediaQuery: () => true,
}));

const record = {
  repoId: 'repo-1',
  repo: { owner: 'openai', name: 'codex' },
  starredAt: null,
} as StarredRepoRecord;

function Harness() {
  const controller = useRepoInspector();
  const location = useLocation();
  const [closeAllowed, setCloseAllowed] = useState<string>('');

  return (
    <div>
      <span data-testid="path">{location.pathname}</span>
      <span data-testid="error">{String(controller.confirmError)}</span>
      <span data-testid="close-allowed">{closeAllowed}</span>
      <button
        type="button"
        data-testid="prepare"
        onClick={() => {
          controller.requestOpen(record, { sourceKey: 'browse', records: [record] });
          controller.syncMemory(record.repoId, {
            repoId: record.repoId,
            source: 'github_star',
            sourceCreatedAt: null,
            whySaved: 'saved reason',
            note: 'saved note',
          });
          controller.setMemoryNote('draft note');
        }}
      />
      <button
        type="button"
        data-testid="attempt-close"
        onClick={() => setCloseAllowed(String(controller.requestClose()))}
      />
      <RepoInspector />
    </div>
  );
}

let container: HTMLDivElement;
let root: Root;

function text(testId: string) {
  return container.querySelector(`[data-testid="${testId}"]`)?.textContent;
}

async function clickTestButton(testId: string) {
  await act(async () => {
    container.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)?.click();
  });
}

async function clickVisibleButton(label: string) {
  const button = [...document.querySelectorAll<HTMLButtonElement>('button')].find((candidate) =>
    candidate.textContent?.includes(label),
  );
  expect(button, `button labeled "${label}"`).toBeDefined();
  await act(async () => button?.click());
}

async function clickLabeledControl(label: string) {
  const control = document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  expect(control, `control aria-label "${label}"`).toBeDefined();
  await act(async () => control?.click());
}

async function fillTextarea(label: string, value: string) {
  const labelElement = [...document.querySelectorAll<HTMLLabelElement>('label')].find(
    (candidate) => candidate.textContent === label,
  );
  const textarea = labelElement?.htmlFor
    ? (document.getElementById(labelElement.htmlFor) as HTMLTextAreaElement | null)
    : null;
  expect(textarea, `textarea labeled "${label}"`).toBeDefined();
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    setter?.call(textarea, value);
    textarea?.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function prepareDirtyNavigation() {
  await clickTestButton('prepare');
  await clickVisibleButton('Read README');
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  expect(text('path')).toBe('/');
}

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => i18n.changeLanguage('en'));
  mocks.mutateAsync.mockReset().mockResolvedValue({
    repoId: 'repo-1',
    source: 'github_star',
    sourceCreatedAt: null,
    whySaved: 'saved reason',
    note: 'draft note',
  });
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
  await act(async () => root.render(<RouterProvider router={router} />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  useRepoInspectorStore.setState({ record: null, context: null });
  container.remove();
});

describe('README navigation with an unsaved Memory', () => {
  it('can leave an unchanged Memory edit without closing Quick Look', async () => {
    await clickTestButton('prepare');
    await clickVisibleButton('Edit');
    await clickVisibleButton('Cancel');
    await clickVisibleButton('Edit');

    const save = [...document.querySelectorAll<HTMLButtonElement>('button')].find((candidate) =>
      candidate.textContent?.includes('Save memory'),
    );
    expect(save?.disabled).toBe(true);

    await clickVisibleButton('Cancel');

    expect(document.body.textContent).toContain('saved reason');
    expect(document.querySelector('textarea')).toBeNull();
    expect(useRepoInspectorStore.getState().record?.repoId).toBe('repo-1');
  });

  it('edits and saves Why saved and Note as one draft', async () => {
    await clickTestButton('prepare');
    await clickVisibleButton('Edit');
    await fillTextarea('Why saved', 'Local-first memory research');
    await fillTextarea('Note', 'Compare this with sqlite-vec');
    mocks.mutateAsync.mockResolvedValueOnce({
      ...mocks.memory,
      whySaved: 'Local-first memory research',
      note: 'Compare this with sqlite-vec',
    });

    await clickVisibleButton('Save memory');

    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      repoId: 'repo-1',
      whySaved: 'Local-first memory research',
      note: 'Compare this with sqlite-vec',
    });
    expect(document.body.textContent).toContain('Local-first memory research');
    expect(document.body.textContent).toContain('Compare this with sqlite-vec');
  });

  it('refuses pickup-style close requests while retaining the draft and inspector', async () => {
    await clickTestButton('prepare');
    await clickTestButton('attempt-close');

    expect(text('close-allowed')).toBe('false');
    expect(useRepoInspectorStore.getState().record?.repoId).toBe('repo-1');
    expect(document.body.textContent).toContain('Save changes');
  });

  it('starts navigation only after save succeeds', async () => {
    await prepareDirtyNavigation();
    await clickVisibleButton('Save changes');

    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      repoId: 'repo-1',
      whySaved: 'saved reason',
      note: 'draft note',
    });
    expect(text('path')).toBe('/repos/openai/codex/readme');
  });

  it('discards the draft before navigating', async () => {
    await prepareDirtyNavigation();
    await clickVisibleButton('Discard changes');

    expect(mocks.mutateAsync).not.toHaveBeenCalled();
    expect(text('path')).toBe('/repos/openai/codex/readme');
  });

  it('continues editing without navigating', async () => {
    await prepareDirtyNavigation();
    await clickLabeledControl('Keep editing');

    expect(document.body.textContent).not.toContain('Save changes');
    expect(text('path')).toBe('/');
  });

  it('keeps the draft and route in place when save fails', async () => {
    mocks.mutateAsync.mockRejectedValueOnce(new Error('save failed'));
    await prepareDirtyNavigation();
    await clickVisibleButton('Save changes');

    expect(text('error')).toBe('true');
    expect(text('path')).toBe('/');
  });
});
