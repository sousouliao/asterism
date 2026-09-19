// @vitest-environment happy-dom

import { ThemeProvider } from '@asterism/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../i18n';
import { SettingsPage } from './settings';

const embedding = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));

vi.mock('../auth/use-session', () => ({
  useSession: () => ({ session: { user: { id: 'user-1', user_metadata: { user_name: 'ada' } } } }),
}));

vi.mock('../contexts/embedding-bootstrap-context', () => ({
  useEmbeddingBootstrapContext: () => embedding.state,
}));

vi.mock('../lib/supabase', () => ({ supabase: {} }));

vi.stubGlobal('matchMedia', (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
}));

let container: HTMLDivElement;
let root: Root;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function renderSettings(overrides: Record<string, unknown> = {}) {
  embedding.state = {
    phase: 'idle',
    modelProgress: 0,
    completed: 0,
    total: 0,
    backend: null,
    error: null,
    optedIn: true,
    repositoryCount: 12,
    start: vi.fn(),
    retry: vi.fn(),
    rebuild: vi.fn(),
    clear: vi.fn(),
    ...overrides,
  };
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  // 连接管理器使用 react-query；生产环境由应用根提供同样的 Provider。
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="light">
          <SettingsPage />
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
}

/** 语义搜索行的标题块：承载 row 标题与状态徽标。 */
function titleBlock(): HTMLElement | null {
  const title = [...container.querySelectorAll('p')].find(
    (node) => node.textContent === i18n.t('settings.semanticSearch'),
  );
  return title?.parentElement ?? null;
}

/** 语义搜索行的动作容器：row 的末位子节点，只应承载可执行动作。 */
function actionBlock(): HTMLElement | null {
  return titleBlock()?.parentElement?.parentElement?.lastElementChild as HTMLElement | null;
}

function actions(): HTMLElement[] {
  return [...(actionBlock()?.querySelectorAll<HTMLElement>('[data-slot="button"]') ?? [])];
}

function actionAt(index: number): HTMLElement {
  const button = actions()[index];
  if (!button) {
    throw new Error(`Missing action button at index ${index}`);
  }
  return button;
}

function stateBadge(): HTMLElement | null {
  return titleBlock()?.querySelector<HTMLElement>('[data-slot="badge"]') ?? null;
}

beforeEach(() => {
  i18n.changeLanguage('en');
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe('Settings semantic search row', () => {
  it('carries the state as row information, not as an action', async () => {
    await renderSettings({ phase: 'ready' });

    expect(stateBadge()?.textContent).toBe(i18n.t('settings.searchReady'));
    expect(actionBlock()?.querySelector('[data-slot="badge"]')).toBeNull();
  });

  it('offers two same-sized maintenance actions once the index is ready', async () => {
    await renderSettings({ phase: 'ready' });

    expect(actionAt(0).textContent).toContain(i18n.t('settings.rebuildSearch'));
    expect(actionAt(1).textContent).toBe(i18n.t('settings.clearSearchModel'));

    for (const button of [actionAt(0), actionAt(1)]) {
      expect(button.className).toContain('h-9');
      expect(button.className).toContain('rounded-md');
    }
    expect(actionAt(1).className).toContain('text-destructive');
    expect(actionAt(0).className).not.toContain('text-destructive');
  });

  it('blocks both maintenance actions and shows in-button progress while rebuilding', async () => {
    await renderSettings({ phase: 'ready', rebuild: vi.fn(() => new Promise(() => {})) });

    await act(async () => {
      actionAt(0).click();
    });

    expect(actionAt(0).getAttribute('aria-busy')).toBe('true');
    expect(actionAt(0).querySelector('.animate-spin')).not.toBeNull();
    expect((actionAt(1) as HTMLButtonElement).disabled).toBe(true);
  });

  it('reports preparation progress without offering an action', async () => {
    await renderSettings({ phase: 'backfilling', completed: 168, total: 400 });

    expect(stateBadge()?.textContent).toContain('42%');
    expect(actions()).toHaveLength(0);
  });

  it('marks a degraded index apart from a healthy one and keeps retry available', async () => {
    await renderSettings({ phase: 'degraded' });

    const badge = stateBadge();
    expect(badge?.textContent).toContain(i18n.t('settings.searchNeedsAttention'));
    expect(badge?.className).toContain('text-destructive');

    expect(actionAt(0).textContent).toContain(i18n.t('common.retry'));
    expect(actionAt(1).textContent).toBe(i18n.t('settings.clearSearchModel'));
  });

  it('asks for a first sync instead of a disabled enable button', async () => {
    await renderSettings({ repositoryCount: 0 });

    expect(actions()).toHaveLength(0);
    expect(actionBlock()?.textContent).toContain(
      i18n.t('settings.semanticSearchNeedsRepositories'),
    );
  });

  it('enables semantic search when repositories are available', async () => {
    await renderSettings({ repositoryCount: 12 });

    expect(actionAt(0).textContent).toBe(i18n.t('settings.enableSemanticSearch'));
    expect((actionAt(0) as HTMLButtonElement).disabled).toBe(false);
  });
});
