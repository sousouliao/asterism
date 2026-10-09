// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../i18n';
import type { ReadmeRouteState } from '../lib/readme-navigation';
import { clearReadmeReturnState } from '../lib/readme-return-coordinator';
import { RepoBaseRedirect } from './repo-base-redirect';
import { RepoReadmePage } from './repo-readme';

const mocks = vi.hoisted(() => ({
  result: {} as {
    data?: { status: string; html?: string; etag?: string | null };
    isPending: boolean;
    isError: boolean;
    refetch: ReturnType<typeof vi.fn>;
  },
  reconnect: vi.fn(),
}));

vi.mock('../data/use-repo-readme', () => ({
  useRepoReadme: () => mocks.result,
}));

vi.mock('../data/use-collections', () => ({
  useCollections: () => ({ data: [{ id: 'collection-7', name: 'AI tools' }] }),
}));

vi.mock('../auth/use-github-reconnect', () => ({
  useGitHubReconnect: () => ({ reconnect: mocks.reconnect, reconnectPending: false }),
}));

let container: HTMLDivElement;
let root: Root;

async function renderPage(locale = 'en', state?: ReadmeRouteState, hash = '') {
  await import('../components/readme-document');
  await import('../components/readme-outline');
  await i18n.changeLanguage(locale);
  const router = createMemoryRouter(
    [
      { path: '/', element: <span>Browse destination</span> },
      { path: '/collections/:id', element: <span>Collection destination</span> },
      { path: '/repos/:owner/:name/readme', element: <RepoReadmePage /> },
    ],
    { initialEntries: [{ pathname: '/repos/openai/codex/readme', hash, state }] },
  );
  await act(async () => root.render(<RouterProvider router={router} />));
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  return router;
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  clearReadmeReturnState();
  mocks.result = { isPending: false, isError: false, refetch: vi.fn() };
  mocks.reconnect.mockReset();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  clearReadmeReturnState();
  container.remove();
  vi.restoreAllMocks();
});

describe('README workspace route', () => {
  it('redirects the readable repository base route to README', async () => {
    const router = createMemoryRouter(
      [
        { path: '/repos/:owner/:name', element: <RepoBaseRedirect /> },
        { path: '/repos/:owner/:name/readme', element: <span>README destination</span> },
      ],
      { initialEntries: ['/repos/openai/codex'] },
    );
    await act(async () => root.render(<RouterProvider router={router} />));

    expect(router.state.location.pathname).toBe('/repos/openai/codex/readme');
    expect(container.textContent).toContain('README destination');
  });

  it.each([
    ['en', 'Back to Browse'],
    ['zh-CN', '返回浏览'],
  ])('renders sanitized authorized README HTML inside the workspace in %s', async (locale, back) => {
    mocks.result.data = {
      status: 'success',
      html: '<h1>Codex</h1><script>alert(1)</script><p>Safe README</p>',
      etag: null,
    };

    await renderPage(locale);
    await act(async () => {
      await vi.waitFor(() => expect(container.textContent).toContain('Safe README'));
    });

    expect(container.textContent).toContain('openai / codex');
    expect(container.textContent).toContain(back);
    expect(container.textContent).toContain('Safe README');
    expect(container.querySelector('script')).toBeNull();
    const workspaceHeader = container.querySelector<HTMLElement>('[data-readme-header]');
    const repoIdentity = container.querySelector<HTMLElement>('[data-readme-repo-identity]');
    expect(workspaceHeader?.className).toContain(
      'grid-cols-[minmax(0,1fr)_minmax(0,auto)_minmax(0,1fr)]',
    );
    expect(repoIdentity?.className).toContain('justify-self-center');
    expect(repoIdentity?.className).toContain('text-center');
    const canvas = container.querySelector<HTMLElement>('[data-readme-canvas="content"]');
    expect(canvas?.dataset.readmeStyleVersion).toBe('1');
    expect(canvas?.className).toContain('max-w-[60rem]');
    expect(canvas?.className).toContain('bg-card');
    expect(canvas?.className).toContain('readme-document-enter');
    const transition = container.querySelector<HTMLElement>('[data-readme-transition="crossfade"]');
    expect(transition).not.toBeNull();
    const outgoingCanvas = transition?.querySelector<HTMLElement>(
      '.readme-document-exit [data-readme-canvas="skeleton"]',
    );
    expect(outgoingCanvas).not.toBeNull();
    expect(outgoingCanvas?.closest('.readme-document-exit')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
    await act(async () => new Promise((resolve) => setTimeout(resolve, 180)));
    expect(transition?.querySelector('[data-readme-canvas="skeleton"]')).toBeNull();
    expect(transition?.querySelector('[data-readme-canvas="content"]')).not.toBeNull();
  });

  it('uses the same versioned solid canvas for the loading document shape', async () => {
    mocks.result = { isPending: true, isError: false, refetch: vi.fn() };

    await renderPage('en');

    const canvas = container.querySelector<HTMLElement>('[data-readme-canvas="skeleton"]');
    expect(canvas?.dataset.readmeStyleVersion).toBe('1');
    expect(canvas?.getAttribute('role')).toBe('status');
    expect(canvas?.getAttribute('aria-busy')).toBe('true');
    expect(canvas?.className).toContain('max-w-[60rem]');
    expect(canvas?.className).toContain('bg-card');
    expect(canvas?.className).not.toContain('backdrop-blur');
    expect(canvas?.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(11);
  });

  it('skips the outgoing skeleton entirely when reduced motion is preferred', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) =>
        ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as MediaQueryList,
    );
    mocks.result.data = {
      status: 'success',
      html: '<h1>Short README</h1>',
      etag: null,
    };

    await renderPage('en');
    await act(async () => {
      await vi.waitFor(() => expect(container.textContent).toContain('Short README'));
    });

    const transition = container.querySelector('[data-readme-transition="crossfade"]');
    expect(transition?.querySelector('[data-readme-canvas="skeleton"]')).toBeNull();
    expect(transition?.querySelector('[data-readme-canvas="content"]')).not.toBeNull();
  });

  it('keeps fragment navigation in the workspace and updates the route hash', async () => {
    mocks.result.data = {
      status: 'success',
      html: '<p>Install</p><a href="#user-content-install">Jump to install</a>',
      etag: null,
    };
    const router = await renderPage('en');
    await act(async () => {
      await vi.waitFor(() => expect(container.textContent).toContain('Jump to install'));
    });
    const fragmentLink = container.querySelector<HTMLAnchorElement>(
      'a[href="#user-content-install"]',
    );
    const target = container.querySelector<HTMLElement>('article');
    if (!target) {
      throw new Error('Expected README fragment target');
    }
    target.id = 'user-content-install';
    expect(target.id).toBe('user-content-install');
    const scrollIntoView = vi.fn();
    Object.defineProperty(target, 'scrollIntoView', { configurable: true, value: scrollIntoView });

    await act(async () => fragmentLink?.click());

    expect(router.state.location.pathname).toBe('/repos/openai/codex/readme');
    expect(router.state.location.hash).toBe('#user-content-install');
    expect(target?.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(target);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
  });

  it('offers adaptive outline presentations and navigates entries with focus and hash updates', async () => {
    mocks.result.data = {
      status: 'success',
      html: `
        <h1>Codex</h1>
        <h2 id="install">Install</h2>
        <h3 id="requirements">Requirements</h3>
        <h2 id="usage">Usage</h2>
      `,
      etag: null,
    };
    const router = await renderPage('en');
    await act(async () => {
      await vi.waitFor(() =>
        expect(container.querySelector('[data-readme-outline="desktop"]')).not.toBeNull(),
      );
    });

    expect(container.querySelector('[data-readme-outline="desktop"]')).not.toBeNull();
    expect(container.querySelector('[data-readme-outline-trigger="popover"]')).not.toBeNull();
    expect(container.querySelector('[data-readme-outline-trigger="sheet"]')).not.toBeNull();
    const railScroll = container.querySelector<HTMLElement>('[data-readme-outline-scroll="rail"]');
    expect(railScroll?.className).toContain('-mr-3');
    expect(railScroll?.className).toContain('pr-3');
    const scrollIntoView = vi.fn();
    vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(scrollIntoView);

    await act(async () =>
      container.querySelector<HTMLButtonElement>('[data-outline-id="usage"]')?.click(),
    );

    const focusedTarget = container.querySelector<HTMLElement>('#usage');
    expect(router.state.location.hash).toBe('#usage');
    expect(focusedTarget?.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(focusedTarget);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(
      container.querySelector('[data-readme-outline="desktop"] [data-outline-id="requirements"]'),
    ).toBeNull();
  });

  it('opens a copied section URL after content loads and hides controls for an empty outline', async () => {
    const scrollIntoView = vi.fn();
    vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(scrollIntoView);
    mocks.result.data = {
      status: 'success',
      html: '<h1>Codex</h1><h2 id="install">Install</h2><h2 id="usage">Usage</h2>',
      etag: null,
    };

    await renderPage('en', undefined, '#usage');
    await act(async () => {
      await vi.waitFor(() =>
        expect(
          container.querySelector('[data-outline-id="usage"]')?.getAttribute('aria-current'),
        ).toBe('location'),
      );
    });
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });

    await act(async () => root.unmount());
    root = createRoot(container);
    mocks.result.data = { status: 'success', html: '<h1>Only a title</h1>', etag: null };
    await renderPage('en');
    expect(container.querySelector('[data-readme-outline="desktop"]')).toBeNull();
    expect(container.querySelector('[data-readme-outline-trigger]')).toBeNull();
  });

  it('tracks natural scrolling with replace semantics instead of growing browser history', async () => {
    mocks.result.data = {
      status: 'success',
      html: '<h1>Codex</h1><h2 id="install">Install</h2><h2 id="usage">Usage</h2>',
      etag: null,
    };
    const router = await renderPage('en');
    const scroller = container.querySelector<HTMLElement>('[data-readme-scroll-container]');
    const install = container.querySelector<HTMLElement>('#install');
    const usage = container.querySelector<HTMLElement>('#usage');
    vi.spyOn(scroller as HTMLElement, 'getBoundingClientRect').mockReturnValue({
      top: 0,
    } as DOMRect);
    vi.spyOn(install as HTMLElement, 'getBoundingClientRect').mockReturnValue({
      top: -20,
    } as DOMRect);
    vi.spyOn(usage as HTMLElement, 'getBoundingClientRect').mockReturnValue({ top: 40 } as DOMRect);

    await act(async () => scroller?.dispatchEvent(new Event('scroll')));

    expect(router.state.location.hash).toBe('#usage');
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('opens the transient outline from the keyboard and preserves selected-heading focus on close', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => undefined);
    mocks.result.data = {
      status: 'success',
      html: '<h1>Codex</h1><h2 id="install">Install</h2><h2 id="usage">Usage</h2>',
      etag: null,
    };
    await renderPage('en');
    const trigger = container.querySelector<HTMLButtonElement>(
      '[data-readme-outline-trigger="popover"]',
    );
    trigger?.focus();

    await act(async () =>
      trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 })),
    );
    const popover = document.querySelector<HTMLElement>('[data-slot="popover-content"]');
    expect(popover).not.toBeNull();

    await act(async () =>
      popover?.querySelector<HTMLButtonElement>('[data-outline-id="usage"]')?.click(),
    );
    expect(document.querySelector('[data-slot="popover-content"]')).toBeNull();
    expect(document.activeElement).toBe(container.querySelector('#usage'));

    await act(async () =>
      container.querySelector<HTMLButtonElement>('[data-readme-outline-trigger="sheet"]')?.click(),
    );
    const sheet = document.querySelector<HTMLElement>('[data-slot="sheet-content"]');
    expect(sheet).not.toBeNull();
    await act(async () =>
      sheet?.querySelector<HTMLButtonElement>('[data-outline-id="install"]')?.click(),
    );
    expect(document.querySelector('[data-slot="sheet-content"]')).toBeNull();
    expect(document.activeElement).toBe(container.querySelector('#install'));
  });

  it('avoids smooth section scrolling when reduced motion is preferred', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) =>
        ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as MediaQueryList,
    );
    const scrollIntoView = vi.fn();
    vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(scrollIntoView);
    mocks.result.data = {
      status: 'success',
      html: '<h1>Codex</h1><h2 id="install">Install</h2><h2 id="usage">Usage</h2>',
      etag: null,
    };
    await renderPage('en');

    await act(async () =>
      container.querySelector<HTMLButtonElement>('[data-outline-id="usage"]')?.click(),
    );

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
  });

  it.each([
    ['en', 'Repository not synced'],
    ['zh-CN', '仓库尚未同步'],
  ])('renders the membership rejection state in %s', async (locale, title) => {
    mocks.result.data = { status: 'not_in_library' };

    await renderPage(locale);

    expect(container.textContent).toContain(title);
    expect(container.querySelector('.markdown-body')).toBeNull();
  });

  it.each([
    ['not_found', 'This repository has no README', 'Check again'],
    ['rate_limited', 'Too many requests', 'Reconnect GitHub'],
    ['reconnect_required', 'GitHub access needs reconnecting', 'Reconnect GitHub'],
    ['retryable_error', "Couldn't load this README", 'Try again'],
  ])('renders dedicated recovery for %s', async (status, title, action) => {
    mocks.result.data = { status };

    await renderPage('en');

    expect(container.textContent).toContain(title);
    expect(container.textContent).toContain(action);
  });

  it('offers reconnect and GitHub escape actions when rate limited', async () => {
    mocks.result.data = { status: 'rate_limited' };

    await renderPage('en');
    const buttons = [...container.querySelectorAll<HTMLButtonElement>('button')];
    const reconnect = buttons.find((button) => button.textContent?.includes('Reconnect GitHub'));

    expect(reconnect).toBeDefined();
    expect(container.querySelector('a[href="https://github.com/openai/codex"]')).not.toBeNull();
    await act(async () => reconnect?.click());
    expect(mocks.reconnect).toHaveBeenCalledOnce();
  });

  it('retries transient failure in place without changing route', async () => {
    mocks.result.data = { status: 'retryable_error' };
    const router = await renderPage('en');
    const retry = [...container.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
      button.textContent?.includes('Try again'),
    );

    await act(async () => retry?.click());

    expect(mocks.result.refetch).toHaveBeenCalledOnce();
    expect(router.state.location.pathname).toBe('/repos/openai/codex/readme');
  });

  it.each([
    ['en', undefined, 'Back to Browse', '/'],
    ['zh-CN', undefined, '返回浏览', '/'],
    [
      'en',
      {
        readme: {
          repoId: 'repo-1',
          owner: 'openai',
          name: 'codex',
          source: {
            kind: 'collection' as const,
            id: 'collection-7',
            name: 'AI tools',
            scrollTop: 0,
          },
        },
      },
      'Back to AI tools',
      '/collections/collection-7',
    ],
    [
      'zh-CN',
      {
        readme: {
          repoId: 'repo-1',
          owner: 'openai',
          name: 'codex',
          source: {
            kind: 'collection' as const,
            id: 'collection-7',
            name: 'AI 工具',
            scrollTop: 0,
          },
        },
      },
      '返回 AI 工具',
      '/collections/collection-7',
    ],
  ] satisfies ReadonlyArray<
    [string, ReadmeRouteState | undefined, string, string]
  >)('uses the visible return action for %s entry', async (locale, state, label, destination) => {
    mocks.result.data = { status: 'retryable_error' };
    const router = await renderPage(locale, state);
    const returnButton = container.querySelector<HTMLButtonElement>('header button');

    expect(returnButton?.textContent).toContain(label);
    await act(async () => returnButton?.click());
    expect(router.state.location.pathname).toBe(destination);
  });

  it('expands from a measured floating Quick Look without blocking the route', async () => {
    const { armForwardWorkspaceMotion, useWorkspaceMotionStore } = await import(
      '../lib/readme-workspace-motion-store'
    );
    armForwardWorkspaceMotion({
      direction: 'forward',
      repoId: 'repo-1',
      sourceRect: { left: 800, top: 200, width: 480, height: 640 },
      floatingQuickLook: true,
    });
    mocks.result.data = { status: 'retryable_error' };

    const originalRect = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
      if ((this as HTMLElement).dataset.readmeWorkspace != null) {
        return {
          left: 240,
          top: 64,
          width: 960,
          height: 800,
          right: 1200,
          bottom: 864,
          x: 240,
          y: 64,
          toJSON() {
            return {};
          },
        } as DOMRect;
      }
      return originalRect.call(this);
    };

    try {
      const router = await renderPage('en', {
        readme: {
          repoId: 'repo-1',
          owner: 'openai',
          name: 'codex',
          source: {
            kind: 'browse',
            snapshot: {
              query: '',
              language: null,
              topic: null,
              collectionIds: [],
              minStars: 0,
              pushedWithinDays: null,
              status: 'all',
              sort: 'starred',
              view: 'grid',
              scrollTop: 0,
            },
          },
        },
      });

      expect(router.state.location.pathname).toBe('/repos/openai/codex/readme');
      expect(container.textContent).toContain('openai / codex');
      expect(useWorkspaceMotionStore.getState().lastMode).toBe('expand');
      expect(
        container.querySelector('[data-readme-workspace]')?.getAttribute('data-workspace-motion'),
      ).toBe('expand');
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalRect;
    }
  });

  it('keeps navigation successful when Web Animations rejects', async () => {
    const { armForwardWorkspaceMotion } = await import('../lib/readme-workspace-motion-store');
    armForwardWorkspaceMotion({
      direction: 'forward',
      repoId: 'repo-1',
      sourceRect: { left: 10, top: 20, width: 400, height: 500 },
      floatingQuickLook: true,
    });
    mocks.result.data = { status: 'retryable_error' };

    const animate = HTMLElement.prototype.animate;
    HTMLElement.prototype.animate = vi.fn(() => ({
      finished: Promise.reject(new DOMException('Aborted', 'AbortError')),
    })) as unknown as typeof HTMLElement.prototype.animate;

    try {
      const router = await renderPage('en', {
        readme: {
          repoId: 'repo-1',
          owner: 'openai',
          name: 'codex',
          source: {
            kind: 'browse',
            snapshot: {
              query: '',
              language: null,
              topic: null,
              collectionIds: [],
              minStars: 0,
              pushedWithinDays: null,
              status: 'all',
              sort: 'starred',
              view: 'grid',
              scrollTop: 0,
            },
          },
        },
      });
      expect(router.state.location.pathname).toBe('/repos/openai/codex/readme');
      expect(container.textContent).toContain('openai / codex');
      expect(container.textContent).toMatch(/Try again|重试/);
    } finally {
      HTMLElement.prototype.animate = animate;
    }
  });

  it('records immediate motion under reduced preference instead of spatial expand', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) =>
        ({
          matches: String(query).includes('prefers-reduced-motion'),
          media: String(query),
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as MediaQueryList,
    );
    const { armForwardWorkspaceMotion, useWorkspaceMotionStore } = await import(
      '../lib/readme-workspace-motion-store'
    );
    armForwardWorkspaceMotion({
      direction: 'forward',
      repoId: 'repo-1',
      sourceRect: { left: 10, top: 20, width: 400, height: 500 },
      floatingQuickLook: true,
    });
    mocks.result.data = { status: 'retryable_error' };

    await renderPage('en', {
      readme: {
        repoId: 'repo-1',
        owner: 'openai',
        name: 'codex',
        source: {
          kind: 'browse',
          snapshot: {
            query: '',
            language: null,
            topic: null,
            collectionIds: [],
            minStars: 0,
            pushedWithinDays: null,
            status: 'all',
            sort: 'starred',
            view: 'grid',
            scrollTop: 0,
          },
        },
      },
    });

    expect(useWorkspaceMotionStore.getState().lastMode).toBe('immediate');
    expect(
      container.querySelector('[data-readme-workspace]')?.getAttribute('data-workspace-motion'),
    ).toBe('immediate');
  });
});
