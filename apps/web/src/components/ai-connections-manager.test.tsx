// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../i18n';
import type { AiConnection, AiSettings } from '../lib/ai-connections';
import { AiConnectionsManager } from './ai-connections-manager';

const hooks = vi.hoisted(() => ({
  useAiConnections: vi.fn(),
  useAiSettings: vi.fn(),
  useCreateAiConnection: vi.fn(),
  useUpdateAiConnection: vi.fn(),
  useTestAiConnection: vi.fn(),
  useDeleteAiConnection: vi.fn(),
  useDiscoverAiConnectionModels: vi.fn(),
  useUpdateAiSettings: vi.fn(),
}));

const askByok = vi.hoisted(() => ({ readAskByok: vi.fn() }));

vi.mock('../data/use-ai-connections', () => hooks);
vi.mock('../auth/use-session', () => ({
  useSession: () => ({ session: { user: { id: 'manager-user' } } }),
}));
vi.mock('../lib/ask-byok', () => askByok);

class ResizeObserverMock {
  observe() {}
  disconnect() {}
}

function idleMutation() {
  return {
    mutate: vi.fn(),
    reset: vi.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
    data: undefined,
  };
}

const connection: AiConnection = {
  id: 'conn-1',
  adapter: 'deepseek',
  name: 'Personal DeepSeek',
  baseUrl: null,
  status: 'valid',
  credentialHint: 'sk-…abcd',
  apiKey: 'sk-test-key-123456',
  generationCapability: {
    ok: true,
    reason: null,
    model: 'deepseek-chat',
    testedAt: '2026-07-20T00:00:00.000Z',
  },
  createdAt: '2026-07-20T00:00:00.000Z',
  updatedAt: '2026-07-20T00:00:00.000Z',
};

const settings: AiSettings = {
  generationConnectionId: 'conn-1',
  includeNotesInAi: true,
};

let container: HTMLDivElement;
let root: Root;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  hooks.useCreateAiConnection.mockReturnValue(idleMutation());
  hooks.useUpdateAiConnection.mockReturnValue(idleMutation());
  hooks.useTestAiConnection.mockReturnValue(idleMutation());
  hooks.useDeleteAiConnection.mockReturnValue(idleMutation());
  hooks.useDiscoverAiConnectionModels.mockReturnValue(idleMutation());
  hooks.useUpdateAiSettings.mockReturnValue(idleMutation());
  askByok.readAskByok.mockReturnValue(null);
});

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

async function render() {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    await i18n.changeLanguage('en');
    root.render(<AiConnectionsManager />);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function openConnectionMenu() {
  const actions = container.querySelector<HTMLButtonElement>('button[aria-label="Actions"]');
  await act(async () => {
    actions?.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1 }),
    );
    actions?.click();
  });
  return [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')];
}

async function pickActiveConnection(name: string) {
  const trigger = container.querySelector<HTMLButtonElement>('#ai-active-connection');
  await act(async () => {
    trigger?.click();
  });
  // Radix 弹层挂在 body；陈旧弹层可能残留，取最后一个匹配的新鲜选项。
  const option = [...document.body.querySelectorAll('[role="option"]')]
    .filter((item) => item.textContent?.includes(name))
    .pop();
  await act(async () => {
    // Radix Select 2.x 依据 pointerup 选择，click 兜底。
    option?.dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1 }),
    );
    option?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

describe('AiConnectionsManager', () => {
  it('teaches with an empty state and hides preferences when there are no connections', async () => {
    hooks.useAiConnections.mockReturnValue({ data: [], isLoading: false });
    hooks.useAiSettings.mockReturnValue({ data: undefined });

    await render();

    expect(container.textContent).toContain('No connections yet');
    expect(container.textContent).toContain('Connect an AI provider to enable Ask Asterism');
    expect(container.textContent).not.toContain('Active connection');
  });

  it('lists connections with their status and surfaces the active preferences', async () => {
    hooks.useAiConnections.mockReturnValue({ data: [connection], isLoading: false });
    hooks.useAiSettings.mockReturnValue({ data: settings });

    await render();

    expect(container.textContent).toContain('Personal DeepSeek');
    expect(container.textContent).toContain('Valid');
    expect(container.textContent).toContain('Active connection');
    expect(container.textContent).toContain('deepseek-chat');
    expect(container.textContent).toContain('Last test:');
    expect(container.textContent).toContain('DeepSeek');
  });

  it('exposes enable or disable as a real connection lifecycle action', async () => {
    const update = idleMutation();
    hooks.useUpdateAiConnection.mockReturnValue(update);
    hooks.useAiConnections.mockReturnValue({ data: [connection], isLoading: false });
    hooks.useAiSettings.mockReturnValue({ data: settings });
    await render();

    const items = await openConnectionMenu();
    const disable = items.find((item) => item.textContent?.includes('Disable'));
    expect(disable).toBeDefined();
    await act(async () => {
      disable?.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1 }),
      );
      disable?.click();
    });

    expect(update.mutate).toHaveBeenCalledWith(
      { connectionId: 'conn-1', enabled: false },
      expect.objectContaining({ onError: expect.any(Function) }),
    );
  });

  it('gates activating a new provider behind the egress consent dialog', async () => {
    const updateSettings = idleMutation();
    hooks.useUpdateAiSettings.mockReturnValue(updateSettings);
    hooks.useAiConnections.mockReturnValue({ data: [connection], isLoading: false });
    hooks.useAiSettings.mockReturnValue({ data: { ...settings, generationConnectionId: null } });
    askByok.readAskByok.mockReturnValue(null);
    await render();

    await pickActiveConnection('Personal DeepSeek');

    // 尚未同意：先披露（弹层挂在 body），不落偏好。
    expect(document.body.textContent).toContain('Allow Ask to send context to DeepSeek');
    expect(updateSettings.mutate).not.toHaveBeenCalled();

    const confirm = [...document.body.querySelectorAll('button')]
      .filter((button) => button.textContent?.includes('I understand — save'))
      .pop();
    await act(async () => {
      confirm?.click();
    });
    expect(updateSettings.mutate).toHaveBeenCalledWith(
      { generationConnectionId: 'conn-1' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('activates without re-disclosure when the provider was already consented', async () => {
    const updateSettings = idleMutation();
    hooks.useUpdateAiSettings.mockReturnValue(updateSettings);
    hooks.useAiConnections.mockReturnValue({ data: [connection], isLoading: false });
    hooks.useAiSettings.mockReturnValue({ data: { ...settings, generationConnectionId: null } });
    askByok.readAskByok.mockReturnValue({ consentedProvider: 'deepseek' });
    await render();

    await pickActiveConnection('Personal DeepSeek');

    expect(updateSettings.mutate).toHaveBeenCalledWith(
      { generationConnectionId: 'conn-1' },
      expect.anything(),
    );
    expect(document.body.textContent).not.toContain('Allow Ask to send context to');
  });

  it('does not offer private-note inclusion without an active connection', async () => {
    hooks.useAiConnections.mockReturnValue({ data: [connection], isLoading: false });
    hooks.useAiSettings.mockReturnValue({ data: { ...settings, generationConnectionId: null } });

    await render();

    expect(container.textContent).toContain('Choose a valid active connection');
    const onOption = [
      ...container.querySelectorAll<HTMLButtonElement>(
        'button[data-slot="segmented-control-item"]',
      ),
    ].find((button) => button.textContent === 'On');
    expect(onOption?.disabled).toBe(true);
  });

  it('opens the test dialog with model discovery from the restored flow', async () => {
    hooks.useTestAiConnection.mockReturnValue({ ...idleMutation(), data: connection });
    hooks.useDiscoverAiConnectionModels.mockReturnValue({
      ...idleMutation(),
      data: ['deepseek-chat', 'deepseek-reasoner'],
      isSuccess: true,
    });
    hooks.useAiConnections.mockReturnValue({ data: [connection], isLoading: false });
    hooks.useAiSettings.mockReturnValue({ data: settings });
    await render();

    const items = await openConnectionMenu();
    const test = items.find((item) => item.textContent?.includes('Test'));
    await act(async () => {
      test?.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1 }),
      );
      test?.click();
    });

    const dialog = [...document.body.querySelectorAll('[role="dialog"]')].pop();
    expect(dialog?.textContent).toContain('Test "Personal DeepSeek"');
    // aria-label 不进 textContent，以属性选择器断言已发现的模型下拉存在。
    const discoverSelect = dialog?.querySelector('[aria-label="Discovered models"]');
    expect(discoverSelect).not.toBeNull();
    expect(dialog?.textContent).toContain('deepseek-reasoner');
  });
});
