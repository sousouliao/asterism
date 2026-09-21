// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type AiConnection,
  clearAiConnectionsState,
  readAiConnections,
  readAiSettings,
  writeAiConnections,
} from '../lib/ai-connections';
import { resetAskByokState, resolveAskByok } from '../lib/ask-byok';
import {
  useCreateAiConnection,
  useDeleteAiConnection,
  useDiscoverAiConnectionModels,
  useTestAiConnection,
  useUpdateAiConnection,
  useUpdateAiSettings,
} from './use-ai-connections';

const db = vi.hoisted(() => ({
  invokeAskTest: vi.fn(),
  invokeAskModels: vi.fn(),
}));

vi.mock('@asterism/db', () => db);
vi.mock('../lib/supabase', () => ({ supabase: {} }));
vi.mock('../auth/use-session', () => ({
  useSession: () => ({ session: { user: { id: 'hooks-user' } } }),
}));

const USER = 'hooks-user';

let container: HTMLDivElement;
let root: Root;
let queryClient: QueryClient;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** 渲染一个把 hook 结果带出来的探针组件；返回的 capture 始终指向最新一次的 hook 值。 */
async function renderHookProbe<T>(useHook: () => T): Promise<() => T> {
  const captured = { current: undefined as T };
  function Probe() {
    captured.current = useHook();
    return null;
  }
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>,
    );
  });
  return () => captured.current as T;
}

function storedConnection(overrides: Partial<AiConnection> = {}): AiConnection {
  return {
    id: 'conn-1',
    adapter: 'deepseek',
    name: 'Personal DeepSeek',
    baseUrl: null,
    status: 'valid',
    credentialHint: 'sk-…3456',
    apiKey: 'sk-test-key-123456',
    generationCapability: {
      ok: true,
      reason: null,
      model: 'deepseek-chat',
      testedAt: '2026-09-20T00:00:00.000Z',
    },
    createdAt: '2026-09-20T00:00:00.000Z',
    updatedAt: '2026-09-20T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  resetAskByokState();
  clearAiConnectionsState();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  vi.clearAllMocks();
});

describe('use-ai-connections mutations', () => {
  it('creates an untested connection in the browser-local library', async () => {
    const hook = await renderHookProbe(useCreateAiConnection);
    let created: AiConnection | undefined;
    await act(async () => {
      created = await hook().mutateAsync({
        adapter: 'deepseek',
        name: 'Personal DeepSeek',
        credential: { apiKey: 'sk-test-key-123456' },
      });
    });

    expect(created?.status).toBe('untested');
    expect(created?.credentialHint).toBe('sk-…3456');
    expect(readAiConnections(USER)).toHaveLength(1);
  });

  it('records probe results on the connection and stores the capability locally', async () => {
    writeAiConnections(USER, [
      storedConnection({ status: 'untested', generationCapability: null }),
    ]);
    db.invokeAskTest.mockResolvedValue({
      status: 'passed',
      tools: true,
      longContext: true,
      mode: 'agent',
    });
    const hook = await renderHookProbe(useTestAiConnection);

    let updated: AiConnection | undefined;
    await act(async () => {
      updated = await hook().mutateAsync({ connectionId: 'conn-1', model: 'deepseek-reasoner' });
    });

    expect(db.invokeAskTest).toHaveBeenCalledWith(expect.anything(), {
      provider: 'deepseek',
      model: 'deepseek-reasoner',
      providerKey: 'sk-test-key-123456',
    });
    expect(updated?.status).toBe('valid');
    expect(updated?.generationCapability).toMatchObject({
      ok: true,
      model: 'deepseek-reasoner',
      tools: true,
      longContext: true,
      mode: 'agent',
    });
  });

  it('marks a rejected credential invalid with the unauthorized reason', async () => {
    writeAiConnections(USER, [storedConnection()]);
    db.invokeAskTest.mockResolvedValue({ status: 'failed', reason: 'unauthorized' });
    const hook = await renderHookProbe(useTestAiConnection);

    let updated: AiConnection | undefined;
    await act(async () => {
      updated = await hook().mutateAsync({ connectionId: 'conn-1', model: 'deepseek-chat' });
    });

    expect(updated?.status).toBe('invalid');
    expect(updated?.generationCapability).toMatchObject({ ok: false, reason: 'unauthorized' });
  });

  it('discovers models through the ask-generate proxy with the stored key', async () => {
    writeAiConnections(USER, [storedConnection()]);
    db.invokeAskModels.mockResolvedValue({
      status: 'success',
      models: ['deepseek-chat', 'deepseek-reasoner'],
    });
    const hook = await renderHookProbe(useDiscoverAiConnectionModels);

    let models: string[] | undefined;
    await act(async () => {
      models = await hook().mutateAsync('conn-1');
    });

    expect(db.invokeAskModels).toHaveBeenCalledWith(expect.anything(), {
      provider: 'deepseek',
      providerKey: 'sk-test-key-123456',
    });
    expect(models).toEqual(['deepseek-chat', 'deepseek-reasoner']);
  });

  it('activates a valid connection so Ask resolves its key from the library', async () => {
    writeAiConnections(USER, [storedConnection()]);
    const hook = await renderHookProbe(useUpdateAiSettings);

    await act(async () => {
      await hook().mutateAsync({ generationConnectionId: 'conn-1' });
    });

    expect(readAiSettings(USER).generationConnectionId).toBe('conn-1');
    expect(resolveAskByok(USER)).toMatchObject({
      connectionId: 'conn-1',
      provider: 'deepseek',
      model: 'deepseek-chat',
      providerKey: 'sk-test-key-123456',
    });
  });

  it('refuses to activate an untested connection and clears ask on deactivate', async () => {
    writeAiConnections(USER, [storedConnection({ status: 'untested' })]);
    writeAiSettingsForTest();
    const hook = await renderHookProbe(useUpdateAiSettings);

    await expect(
      act(async () => {
        await hook().mutateAsync({ generationConnectionId: 'conn-1' });
      }),
    ).rejects.toThrow('connection_not_valid');
    expect(resolveAskByok(USER)).toBeNull();

    writeAiConnections(USER, [storedConnection()]);
    await act(async () => {
      await hook().mutateAsync({ generationConnectionId: 'conn-1' });
    });
    expect(resolveAskByok(USER)).not.toBeNull();
    await act(async () => {
      await hook().mutateAsync({ generationConnectionId: null });
    });
    expect(resolveAskByok(USER)).toBeNull();
  });

  it('stops Ask from using the old key the moment the active key is rotated', async () => {
    writeAiConnections(USER, [storedConnection()]);
    const settings = await renderHookProbe(useUpdateAiSettings);
    await act(async () => {
      await settings().mutateAsync({ generationConnectionId: 'conn-1' });
    });
    expect(resolveAskByok(USER)?.providerKey).toBe('sk-test-key-123456');

    const update = await renderHookProbe(useUpdateAiConnection);
    await act(async () => {
      await update().mutateAsync({
        connectionId: 'conn-1',
        credential: { apiKey: 'sk-rotated-key-999999' },
      });
    });

    // 轮换让连接回到未探测状态：Ask 必须立即失去配置，而不是继续用旧 key。
    expect(resolveAskByok(USER)).toBeNull();
    expect(readAiConnections(USER)[0]?.apiKey).toBe('sk-rotated-key-999999');
  });

  it('stops Ask from using a disabled active connection', async () => {
    writeAiConnections(USER, [storedConnection()]);
    const settings = await renderHookProbe(useUpdateAiSettings);
    await act(async () => {
      await settings().mutateAsync({ generationConnectionId: 'conn-1' });
    });
    expect(resolveAskByok(USER)).not.toBeNull();

    const update = await renderHookProbe(useUpdateAiConnection);
    await act(async () => {
      await update().mutateAsync({ connectionId: 'conn-1', enabled: false });
    });

    expect(resolveAskByok(USER)).toBeNull();
  });

  it('deleting the active connection clears the preference and ask config', async () => {
    writeAiConnections(USER, [storedConnection()]);
    writeAiSettingsForTest();
    const hook = await renderHookProbe(useDeleteAiConnection);

    await act(async () => {
      await hook().mutateAsync(storedConnection());
    });

    expect(readAiConnections(USER)).toHaveLength(0);
    expect(readAiSettings(USER).generationConnectionId).toBeNull();
    expect(resolveAskByok(USER)).toBeNull();
  });
});

function writeAiSettingsForTest() {
  localStorage.setItem(
    `asterism:ai-settings:v1:${USER}`,
    JSON.stringify({ generationConnectionId: 'conn-1', includeNotesInAi: true }),
  );
  clearAiConnectionsState();
}
