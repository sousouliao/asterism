// @vitest-environment happy-dom

import type { StarredRepoRecord } from '@asterism/db';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type AiConnection,
  clearAiConnectionsState,
  writeAiConnections,
} from '../lib/ai-connections';
import { resetAskByokState, saveAskConsent } from '../lib/ask-byok';
import { useAskQuestion } from './use-ask-question';
import { QUERY_DEBOUNCE_MS } from './use-semantic-search';

const mocks = vi.hoisted(() => ({
  streamAskGenerate: vi.fn(),
  listStarredRepos: vi.fn(),
  listMemories: vi.fn(),
  searchRepoEmbeddings: vi.fn(),
  embed: vi.fn(),
  session: { current: { user: { id: 'user-a' } } as { user: { id: string } } | null },
  embedding: {
    current: { optedIn: false, phase: 'idle', backend: null } as {
      optedIn: boolean;
      phase: string;
      backend: unknown;
    },
  },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@asterism/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@asterism/db')>()),
  streamAskGenerate: mocks.streamAskGenerate,
  listStarredRepos: mocks.listStarredRepos,
  listMemories: mocks.listMemories,
  searchRepoEmbeddings: mocks.searchRepoEmbeddings,
}));

vi.mock('../auth/use-session', () => ({
  useSession: () => ({ session: mocks.session.current }),
}));

vi.mock('../contexts/embedding-bootstrap-context', () => ({
  useEmbeddingBootstrapContext: () => mocks.embedding.current,
}));

vi.mock('../lib/embedding-runtime', () => ({
  getEmbeddingRuntime: () => ({ embed: mocks.embed }),
}));

function repoRecord(
  repoId: string,
  overrides: Partial<StarredRepoRecord['repo']>,
): StarredRepoRecord {
  return {
    repoId,
    starredAt: '2025-01-01T00:00:00Z',
    repo: {
      githubId: 1,
      fullName: `${repoId}/${repoId}`,
      name: repoId,
      owner: repoId,
      description: null,
      language: null,
      topics: [],
      stargazers: 100,
      forks: 1,
      homepage: null,
      pushedAt: null,
      repoCreatedAt: null,
      archived: false,
      isFork: false,
      syncedAt: '2026-01-01T00:00:00Z',
      ...overrides,
    },
  };
}

const RECORDS: StarredRepoRecord[] = [
  repoRecord('repo-ws', {
    fullName: 'rustws/tungstenite',
    description: 'Lightweight WebSocket stream implementation',
    topics: ['websocket'],
  }),
  repoRecord('repo-memo', {
    fullName: 'memo/sticky',
    description: 'Sticky notes on your desktop',
  }),
];

const ANSWER = '[0] Tungstenite is the match.\n\n```asterism-recommendations\n[0]\n```';

let root: Root | undefined;
let container: HTMLDivElement | undefined;
let queryClient: QueryClient | undefined;
let latest: ReturnType<typeof useAskQuestion> | undefined;

function Harness() {
  latest = useAskQuestion();
  return null;
}

async function renderHarness() {
  if (!container) {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  }
  await act(async () => {
    root?.render(
      <QueryClientProvider client={queryClient as QueryClient}>
        <Harness />
      </QueryClientProvider>,
    );
    await Promise.resolve();
  });
}

async function flushWork() {
  for (let round = 0; round < 2; round += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function flushDebounce() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, QUERY_DEBOUNCE_MS + 20));
  });
  await flushWork();
}

async function ask(question: string) {
  await act(async () => {
    latest?.ask(question);
    await Promise.resolve();
  });
}

beforeEach(() => {
  mocks.streamAskGenerate.mockReset().mockImplementation(async (_client, _request, options) => {
    options.onDelta(ANSWER);
    return { status: 'success', content: ANSWER };
  });
  mocks.listStarredRepos.mockReset().mockResolvedValue(RECORDS);
  mocks.listMemories.mockReset().mockResolvedValue([]);
  mocks.searchRepoEmbeddings.mockReset();
  mocks.embed.mockReset();
  mocks.session.current = { user: { id: 'user-a' } };
  mocks.embedding.current = { optedIn: false, phase: 'idle', backend: null };
  configureAskConnection();
});

/** Ask 的可用配置 = 已同意 + 一条通过探针的连接（key 在使用时现取）。 */
function configureAskConnection(overrides: Partial<AiConnection> = {}) {
  const connection: AiConnection = {
    id: 'conn-1',
    adapter: 'openai',
    name: 'Test key',
    baseUrl: null,
    status: 'valid',
    credentialHint: 'sk-…test',
    apiKey: 'sk-test',
    generationCapability: { ok: true, model: 'gpt-4o-mini', testedAt: 'now', reason: null },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
  writeAiConnections('user-a', [connection]);
  saveAskConsent('user-a', { connectionId: connection.id, provider: connection.adapter });
  return connection;
}

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
  }
  container?.remove();
  queryClient?.clear();
  root = undefined;
  container = undefined;
  queryClient = undefined;
  resetAskByokState();
  clearAiConnectionsState();
  window.localStorage.clear();
});

describe('useAskQuestion', () => {
  it('answers a follow-up question in the same panel session', async () => {
    await renderHarness();
    await flushWork();

    await ask('websocket library');
    await flushWork();
    expect(latest?.phase.kind).toBe('answered');

    // 回归：提交 id 不自增时，第二问被 settledId 判为已处理而永远停在 recalling。
    await ask('websocket stream');
    await flushWork();
    expect(latest?.phase.kind).toBe('answered');
    expect(latest?.turns).toHaveLength(2);
    expect(mocks.streamAskGenerate).toHaveBeenCalledTimes(2);
  });

  it('proceeds when the user retries after a provider rejection', async () => {
    mocks.streamAskGenerate
      .mockResolvedValueOnce({ status: 'provider_rejected' })
      .mockImplementationOnce(async (_client, _request, options) => {
        options.onDelta(ANSWER);
        return { status: 'success', content: ANSWER };
      });
    await renderHarness();
    await flushWork();

    await ask('websocket library');
    await flushWork();
    expect(latest?.phase).toMatchObject({ kind: 'error', reason: 'provider_rejected' });

    await ask('websocket library');
    await flushWork();
    expect(latest?.phase.kind).toBe('answered');
    expect(mocks.streamAskGenerate).toHaveBeenCalledTimes(2);
  });

  it('waits for the semantic channel instead of bypassing it', async () => {
    mocks.embedding.current = { optedIn: true, phase: 'ready', backend: {} };
    mocks.embed.mockResolvedValue([[0.1, 0.2]]);
    let resolveNeighbors: (value: { repoId: string; distance: number }[]) => void = () => {};
    mocks.searchRepoEmbeddings.mockReturnValue(
      new Promise((resolve) => {
        resolveNeighbors = resolve;
      }),
    );
    await renderHarness();
    await flushWork();

    await ask('daily journaling');
    await flushDebounce();
    // 语义检索仍在途：不得进入 generating，也不得提前发起生成。
    expect(latest?.phase.kind).toBe('recalling');
    expect(mocks.streamAskGenerate).not.toHaveBeenCalled();

    await act(async () => {
      resolveNeighbors([{ repoId: 'repo-memo', distance: 0.31 }]);
      await Promise.resolve();
    });
    await flushWork();
    expect(latest?.phase.kind).toBe('answered');
    // 无词法命中的 repo-memo 只能经语义通道成为候选。
    const turn = latest?.turns[0];
    expect(turn?.candidates.map((candidate) => candidate.repoId)).toEqual(['repo-memo']);
    expect(turn?.candidates[0]?.lexicalScore).toBeNull();
    expect(mocks.streamAskGenerate).toHaveBeenCalledTimes(1);
  });
});
