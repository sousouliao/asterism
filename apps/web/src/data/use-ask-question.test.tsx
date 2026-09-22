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

const mocks = vi.hoisted(() => ({
  streamAskGenerate: vi.fn(),
  listLibraryRepos: vi.fn(),
  listMemories: vi.fn(),
  session: { current: { user: { id: 'user-a' } } as { user: { id: string } } | null },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@asterism/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@asterism/db')>()),
  streamAskGenerate: mocks.streamAskGenerate,
  listLibraryRepos: mocks.listLibraryRepos,
  listMemories: mocks.listMemories,
}));

vi.mock('../auth/use-session', () => ({
  useSession: () => ({ session: mocks.session.current }),
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

const ANSWER = 'Tungstenite is the match.\n\n```asterism-recommendations\n["repo-ws"]\n```';

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

async function ask(question: string) {
  await act(async () => {
    latest?.ask(question);
    await Promise.resolve();
  });
}

beforeEach(() => {
  mocks.streamAskGenerate.mockReset().mockImplementation(async (_client, _request, options) => {
    options.onDelta(ANSWER);
    return { status: 'success', content: ANSWER, toolCalls: [] };
  });
  mocks.listLibraryRepos.mockReset().mockResolvedValue(RECORDS);
  mocks.listMemories.mockReset().mockResolvedValue([]);
  mocks.session.current = { user: { id: 'user-a' } };
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

    // 回归：提交 id 不自增时，第二问被 settledId 判为已处理而永远停在 generating。
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
        return { status: 'success', content: ANSWER, toolCalls: [] };
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

  it('executes an expand tool call before accepting recommendations', async () => {
    mocks.streamAskGenerate
      .mockImplementationOnce(async () => ({
        status: 'success',
        content: '',
        toolCalls: [{ id: 'c1', name: 'expand', arguments: '{"ids":["repo-ws"]}' }],
      }))
      .mockImplementationOnce(async (_client, _request, options) => {
        options.onDelta(ANSWER);
        return { status: 'success', content: ANSWER, toolCalls: [] };
      });
    await renderHarness();
    await flushWork();
    await ask('websocket library');
    await flushWork();
    expect(latest?.phase.kind).toBe('answered');
    expect(latest?.turns[0]?.recommendations.map((item) => item.repoId)).toEqual(['repo-ws']);
    expect(mocks.streamAskGenerate).toHaveBeenCalledTimes(2);
  });

  // ADR 0046：不按模型能力分流。不调工具的模型照样拿到完整目录并给出正文，
  // 只是没有通过 read gate 的推荐卡片——这远好过退回固定召回后答「没找到」。
  it('answers from the catalog when the model never calls a tool', async () => {
    mocks.streamAskGenerate.mockImplementationOnce(async (_client, _request, options) => {
      options.onDelta('Nothing in your collection does that.');
      return { status: 'success', content: 'Nothing in your collection does that.', toolCalls: [] };
    });
    await renderHarness();
    await flushWork();
    await ask('websocket library');
    await flushWork();

    expect(latest?.phase.kind).toBe('answered');
    expect(latest?.turns[0]?.summary).toBe('Nothing in your collection does that.');
    expect(latest?.turns[0]?.recommendations).toEqual([]);
    expect(mocks.streamAskGenerate.mock.calls[0]?.[1]).toHaveProperty('tools');
  });

  it('allows loading a historical session and starting a new session', async () => {
    await renderHarness();
    await flushWork();

    const mockSession = {
      id: 'session-prev',
      title: 'Historical Question',
      createdAt: Date.now() - 10000,
      updatedAt: Date.now() - 5000,
      turns: [
        {
          id: 10,
          question: 'Historical Question',
          summary: 'Historical answer',
          recommendations: [],
        },
      ],
    };

    await act(async () => {
      latest?.loadSession(mockSession);
    });

    expect(latest?.currentSessionId).toBe('session-prev');
    expect(latest?.turns).toHaveLength(1);
    expect(latest?.turns[0]?.question).toBe('Historical Question');
    expect(latest?.phase.kind).toBe('answered');

    await act(async () => {
      latest?.startNewSession();
    });

    expect(latest?.currentSessionId).toBeNull();
    expect(latest?.turns).toHaveLength(0);
    expect(latest?.phase.kind).toBe('idle');
  });
});
