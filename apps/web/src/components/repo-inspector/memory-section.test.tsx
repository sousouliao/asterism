// @vitest-environment happy-dom

import type { StarredRepoRecord } from '@asterism/db';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RepoInspectorProvider } from '../../contexts/repo-inspector-context';
import i18n from '../../i18n';
import { MemorySection } from './memory-section';

const mocks = vi.hoisted(() => ({
  memory: null as {
    repoId: string;
    source: 'github_star';
    sourceCreatedAt: string | null;
    whySaved: string | null;
    note: string | null;
  } | null,
}));

vi.mock('../../data/use-memory', () => ({
  useMemory: () => ({ data: mocks.memory, isLoading: false }),
  useSaveMemory: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('../../hooks/use-media-query', () => ({
  useMediaQuery: () => true,
}));

const record = {
  repoId: 'repo-1',
  repo: { owner: 'lobehub', name: 'streamdown' },
  starredAt: '2026-09-19T00:00:00Z',
} as StarredRepoRecord;

let container: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  await i18n.changeLanguage('zh-CN');
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  mocks.memory = null;
});

function renderSection() {
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <RepoInspectorProvider>
            <MemorySection record={record} />
          </RepoInspectorProvider>
        ),
      },
    ],
    { initialEntries: ['/'] },
  );
  return act(async () => {
    root.render(<RouterProvider router={router} />);
  });
}

describe('MemorySection typography', () => {
  it('renders fallback placeholders with text-caption and text-muted-foreground when empty', async () => {
    mocks.memory = null;
    await renderSection();

    const paragraphs = container.querySelectorAll('p');
    const whySavedFallback = Array.from(paragraphs).find((p) => p.textContent === '尚未记录');
    const noteFallback = Array.from(paragraphs).find((p) => p.textContent === '还没有笔记');

    expect(whySavedFallback).not.toBeNull();
    expect(whySavedFallback?.className).toContain('text-caption');
    expect(whySavedFallback?.className).toContain('text-muted-foreground');
    expect(whySavedFallback?.className).not.toContain('text-body');

    expect(noteFallback).not.toBeNull();
    expect(noteFallback?.className).toContain('text-caption');
    expect(noteFallback?.className).toContain('text-muted-foreground');
    expect(noteFallback?.className).not.toContain('text-body');
  });

  it('renders recorded content with text-caption and text-foreground when present', async () => {
    mocks.memory = {
      repoId: 'repo-1',
      source: 'github_star',
      sourceCreatedAt: '2026-09-19T00:00:00Z',
      whySaved: '流式渲染引擎',
      note: '生产环境备选',
    };
    await renderSection();

    const paragraphs = container.querySelectorAll('p');
    const whySavedContent = Array.from(paragraphs).find((p) =>
      p.textContent?.includes('流式渲染引擎'),
    );
    const noteContent = Array.from(paragraphs).find((p) => p.textContent?.includes('生产环境备选'));

    expect(whySavedContent).not.toBeNull();
    expect(whySavedContent?.className).toContain('text-caption');
    expect(whySavedContent?.className).toContain('text-foreground/90');
    expect(whySavedContent?.className).not.toContain('text-body');

    expect(noteContent).not.toBeNull();
    expect(noteContent?.className).toContain('text-caption');
    expect(noteContent?.className).toContain('text-foreground/90');
    expect(noteContent?.className).not.toContain('text-body');
  });
});
