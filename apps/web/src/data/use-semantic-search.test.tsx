// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  QUERY_DEBOUNCE_MS,
  SEMANTIC_MATCH_COUNT,
  type SemanticNeighborsResult,
  useSemanticNeighbors,
} from './use-semantic-search';

const mocks = vi.hoisted(() => ({
  embed: vi.fn(),
  searchRepoEmbeddings: vi.fn(),
  session: { current: { user: { id: 'user-a' } } as { user: { id: string } } | null },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@asterism/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@asterism/db')>()),
  searchRepoEmbeddings: mocks.searchRepoEmbeddings,
}));

vi.mock('../auth/use-session', () => ({
  useSession: () => ({ session: mocks.session.current }),
}));

// 动态 import('../lib/embedding-runtime') 也被拦截：断言未授权 / 空查询时绝不派生运行时。
vi.mock('../lib/embedding-runtime', () => ({
  getEmbeddingRuntime: () => ({ embed: mocks.embed }),
}));

let root: Root | undefined;
let container: HTMLDivElement | undefined;
let queryClient: QueryClient | undefined;
let latest: SemanticNeighborsResult | undefined;

function Harness({ query, enabled }: { query: string; enabled: boolean }) {
  latest = useSemanticNeighbors(query, { enabled });
  return null;
}

async function render(props: { query: string; enabled: boolean }) {
  if (!container) {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  }
  await act(async () => {
    root?.render(
      <QueryClientProvider client={queryClient as QueryClient}>
        <Harness query={props.query} enabled={props.enabled} />
      </QueryClientProvider>,
    );
    await Promise.resolve();
  });
}

// queryFn 链是 await import → 防抖窗口 → embed → RPC；先跨过防抖再补 macrotask flush，
// 稳妥收敛 fetch 与其后的重渲染。
async function flush() {
  for (let round = 0; round < 2; round += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, round === 0 ? QUERY_DEBOUNCE_MS + 20 : 0));
    });
  }
}

beforeEach(() => {
  mocks.embed.mockReset();
  mocks.searchRepoEmbeddings.mockReset();
  mocks.session.current = { user: { id: 'user-a' } };
  latest = undefined;
});

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
  }
  container?.remove();
  queryClient?.clear();
  root = undefined;
  container = undefined;
  queryClient = undefined;
});

describe('useSemanticNeighbors', () => {
  it('never embeds or queries the network until the user has opted in', async () => {
    await render({ query: 'vector search', enabled: false });
    await flush();

    expect(mocks.embed).not.toHaveBeenCalled();
    expect(mocks.searchRepoEmbeddings).not.toHaveBeenCalled();
    expect(latest?.distanceByRepoId.size).toBe(0);
    expect(latest?.isSearching).toBe(false);
  });

  it('stays idle for a blank query even when enabled', async () => {
    await render({ query: '   ', enabled: true });
    await flush();

    expect(mocks.embed).not.toHaveBeenCalled();
    expect(mocks.searchRepoEmbeddings).not.toHaveBeenCalled();
    expect(latest?.distanceByRepoId.size).toBe(0);
  });

  it('embeds the query locally with the e5 prefix and maps neighbor distances', async () => {
    mocks.embed.mockResolvedValue([[0.1, 0.2, 0.3]]);
    mocks.searchRepoEmbeddings.mockResolvedValue([
      { repoId: 'repo-1', distance: 0.12 },
      { repoId: 'repo-2', distance: 0.34 },
    ]);

    await render({ query: 'vector search', enabled: true });
    await flush();

    expect(mocks.embed).toHaveBeenCalledWith(['query: vector search']);
    expect(mocks.searchRepoEmbeddings.mock.calls[0]?.[1]).toEqual({
      queryEmbedding: [0.1, 0.2, 0.3],
      matchCount: SEMANTIC_MATCH_COUNT,
    });
    expect(latest?.distanceByRepoId).toEqual(
      new Map([
        ['repo-1', 0.12],
        ['repo-2', 0.34],
      ]),
    );
  });

  it('reports searching while a changed query is still debounced', async () => {
    mocks.embed.mockResolvedValue([[0.1]]);
    mocks.searchRepoEmbeddings.mockResolvedValue([]);

    await render({ query: 'vector', enabled: true });
    await flush();
    expect(latest?.isSearching).toBe(false);

    await render({ query: 'vector search', enabled: true });
    // 防抖窗口内 fetch 尚未派发，但等待方（Ask 编排）必须看到「还在检索」，
    // 否则会误判语义通道已完成而绕过它。
    expect(latest?.isSearching).toBe(true);
    expect(mocks.embed).not.toHaveBeenCalledWith(['query: vector search']);

    await flush();
    expect(mocks.embed).toHaveBeenCalledWith(['query: vector search']);
    expect(latest?.isSearching).toBe(false);
  });
});
