// @vitest-environment happy-dom
import type { StarredRepoRecord } from '@asterism/db';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { previewRepo } from '../fixtures/preview-repo';
import {
  readRepoDigest,
  resetRepoDigestStorageState,
  saveRepoDigest,
} from '../lib/repo-digest-storage';
import { useRepoDigestManager } from './use-repo-digest';

const mocks = vi.hoisted(() => ({
  streamAskGenerate: vi.fn(),
  loadRepoReadme: vi.fn(),
  byok: {
    current: {
      connectionId: 'conn-1',
      provider: 'deepseek',
      model: 'deepseek-chat',
      providerKey: 'sk-deepseek-test',
    } as {
      connectionId: string;
      provider: 'deepseek' | 'openai' | 'anthropic' | 'openrouter';
      model: string;
      providerKey: string;
    } | null,
  },
  session: {
    current: {
      user: { id: 'test-user-id' },
      provider_token: 'test-gh-token',
    } as { user: { id: string }; provider_token?: string } | null,
  },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../auth/use-session', () => ({
  useSession: () => ({ session: mocks.session.current }),
}));

vi.mock('../lib/ask-byok', () => ({
  useAskByok: () => mocks.byok.current,
}));

vi.mock('@asterism/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@asterism/db')>();
  return {
    ...actual,
    streamAskGenerate: mocks.streamAskGenerate,
  };
});

vi.mock('./use-repo-readme', () => ({
  loadRepoReadme: mocks.loadRepoReadme,
}));

const USER_ID = 'test-user-id';
const SAMPLE_RECORD: StarredRepoRecord = {
  repoId: 'repo-streamdown',
  starredAt: '2026-03-01T00:00:00Z',
  repo: previewRepo({
    githubId: 101,
    fullName: 'lobehub/streamdown',
    name: 'streamdown',
    owner: 'lobehub',
    description: 'Headless streaming markdown parser',
    language: 'TypeScript',
    topics: ['markdown', 'streaming'],
    stargazers: 1200,
  }),
};

let root: Root | undefined;
let container: HTMLDivElement | undefined;
let queryClient: QueryClient | undefined;
let latest: ReturnType<typeof useRepoDigestManager> | undefined;

function Harness({ record }: { record: StarredRepoRecord | null }) {
  latest = useRepoDigestManager(record);
  return null;
}

async function renderHarness(record: StarredRepoRecord | null = SAMPLE_RECORD) {
  if (!container) {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  }
  await act(async () => {
    root?.render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient as QueryClient}>
          <Harness record={record} />
        </QueryClientProvider>
      </MemoryRouter>,
    );
    await Promise.resolve();
  });
}

describe('useRepoDigestManager', () => {
  beforeEach(() => {
    localStorage.clear();
    resetRepoDigestStorageState();
    vi.clearAllMocks();

    mocks.session.current = {
      user: { id: USER_ID },
      provider_token: 'test-gh-token',
    };

    mocks.byok.current = {
      connectionId: 'conn-1',
      provider: 'deepseek',
      model: 'deepseek-chat',
      providerKey: 'sk-deepseek-test',
    };
  });

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
      root = undefined;
    }
    if (container) {
      container.remove();
      container = undefined;
    }
    localStorage.clear();
    resetRepoDigestStorageState();
  });

  it('returns unconfigured status when user has no AI byok setup and no cache', async () => {
    mocks.byok.current = null;
    await renderHarness();

    expect(latest?.status).toBe('unconfigured');
    expect(latest?.data).toBeNull();
  });

  it('returns idle status when byok is setup and no digest is cached', async () => {
    await renderHarness();

    expect(latest?.status).toBe('idle');
    expect(latest?.data).toBeNull();
  });

  it('returns completed status immediately when digest is cached in local storage', async () => {
    const cached = {
      definition: '专为 AI 设计的无头流式 Markdown 解析器',
      painPoint: '解决频繁重绘导致的页面跳动',
      scenarios: 'AI 聊天气泡与打字机输出界面',
    };
    saveRepoDigest(USER_ID, SAMPLE_RECORD.repoId, cached);

    await renderHarness();

    expect(latest?.status).toBe('completed');
    expect(latest?.data).toEqual(cached);
  });

  it('generates, parses, and persists structured digest on generate call', async () => {
    mocks.loadRepoReadme.mockResolvedValue({
      status: 'success',
      html: '<h1>Streamdown</h1><p>Smooth reveal animation for tokens</p>',
      etag: null,
    });

    mocks.streamAskGenerate.mockResolvedValue({
      status: 'success',
      content: JSON.stringify({
        definition: '无头 Markdown 流式渲染器',
        painPoint: '解决传统渲染器重绘闪烁',
        scenarios: 'LLM 对话组件',
      }),
    });

    await renderHarness();

    await act(async () => {
      await latest?.generate();
    });

    expect(latest?.status).toBe('completed');
    expect(latest?.data).toEqual({
      definition: '无头 Markdown 流式渲染器',
      painPoint: '解决传统渲染器重绘闪烁',
      scenarios: 'LLM 对话组件',
    });

    expect(readRepoDigest(USER_ID, SAMPLE_RECORD.repoId)).toEqual({
      definition: '无头 Markdown 流式渲染器',
      painPoint: '解决传统渲染器重绘闪烁',
      scenarios: 'LLM 对话组件',
    });
  });
});
