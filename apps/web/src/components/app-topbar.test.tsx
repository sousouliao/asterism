// @vitest-environment happy-dom

import { TooltipProvider } from '@asterism/ui';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../i18n';
import { useBrowseFilters } from '../stores/browse-filters';
import { AppTopbar } from './app-topbar';

vi.mock('../auth/use-session', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

vi.mock('../contexts/embedding-bootstrap-context', () => ({
  useEmbeddingBootstrapContext: () => ({
    phase: 'idle',
    modelProgress: 0,
    completed: 0,
    total: 0,
    backend: null,
    error: null,
    optedIn: false,
    repositoryCount: 1,
    start: vi.fn(),
    retry: vi.fn(),
    rebuild: vi.fn(),
    clear: vi.fn(),
  }),
}));

vi.mock('./language-toggle', () => ({ LanguageToggle: () => null }));
vi.mock('./sidebar-nav', () => ({ SidebarNav: () => null }));
vi.mock('./theme-toggle', () => ({ ThemeToggle: () => null }));
vi.mock('./user-menu', () => ({ UserMenu: () => null }));

let container: HTMLDivElement;
let root: Root;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function renderTopbar(pathname: string) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);

  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <TooltipProvider>
            <AppTopbar />
          </TooltipProvider>
        ),
      },
    ],
    { initialEntries: [pathname] },
  );

  await act(async () => root.render(<RouterProvider router={router} />));
}

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  useBrowseFilters.getState().setQuery('');
});

describe('AppTopbar route scope', () => {
  it('shows repository search on the Browse index route', async () => {
    await renderTopbar('/');

    expect(container.querySelector('input[aria-label]')).not.toBeNull();
  });

  it('hides repository search outside Browse', async () => {
    await renderTopbar('/collections');

    expect(container.querySelector('input[aria-label]')).toBeNull();
  });

  it('keeps the search input focused when semantic search discovery opens', async () => {
    await renderTopbar('/');
    const input = container.querySelector<HTMLInputElement>('input[aria-label]');
    expect(input).not.toBeNull();

    await act(async () => {
      input?.focus();
      useBrowseFilters.getState().setQuery('s');
    });

    expect(document.activeElement).toBe(input);
    expect(document.body.textContent).toContain('Search by meaning');
  });
});
