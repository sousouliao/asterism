// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { type AiConnection, clearAiConnectionsState, writeAiConnections } from './ai-connections';
import {
  askConsentStorageKey,
  clearAskConsent,
  readAskConsent,
  resetAskByokState,
  resolveAskByok,
  saveAskConsent,
  useAskByok,
} from './ask-byok';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function Harness({ userId }: { userId: string }) {
  const byok = useAskByok(userId);
  return <span data-testid="key">{byok ? byok.providerKey : 'none'}</span>;
}

function connection(overrides: Partial<AiConnection> = {}): AiConnection {
  return {
    id: 'conn-1',
    adapter: 'deepseek',
    name: 'Work key',
    baseUrl: null,
    status: 'valid',
    credentialHint: 'sk-…3456',
    apiKey: 'sk-original-123456',
    generationCapability: { ok: true, model: 'deepseek-chat', testedAt: 'now', reason: null },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

/** 建立「已同意 + 一条通过探针的连接」这一可用起点。 */
function configure(userId: string, overrides: Partial<AiConnection> = {}) {
  const record = connection(overrides);
  writeAiConnections(userId, [record]);
  saveAskConsent(userId, { connectionId: record.id, provider: record.adapter });
  return record;
}

beforeEach(() => {
  localStorage.clear();
  resetAskByokState();
  clearAiConnectionsState();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

describe('ask consent storage', () => {
  it('returns null when nothing is stored', () => {
    expect(readAskConsent('user-a')).toBeNull();
    expect(resolveAskByok('user-a')).toBeNull();
  });

  it('never persists the provider key, only the consent record', () => {
    configure('user-a');

    const raw = localStorage.getItem(askConsentStorageKey('user-a')) ?? '';
    expect(raw).not.toContain('sk-original');
    expect(JSON.parse(raw)).toMatchObject({
      connectionId: 'conn-1',
      consentedProvider: 'deepseek',
    });
  });

  it('purges the legacy v1 snapshot that stored a plaintext key copy', () => {
    localStorage.setItem(
      'asterism:ask-byok:v1:user-a',
      JSON.stringify({ provider: 'deepseek', model: 'deepseek-chat', providerKey: 'sk-leaked' }),
    );

    readAskConsent('user-a');

    expect(localStorage.getItem('asterism:ask-byok:v1:user-a')).toBeNull();
  });

  it('resolves the key from the connection library at use time', () => {
    configure('user-a');

    expect(resolveAskByok('user-a')).toMatchObject({
      provider: 'deepseek',
      model: 'deepseek-chat',
      providerKey: 'sk-original-123456',
    });
  });

  it('rejects stored consent for unknown providers', () => {
    localStorage.setItem(
      askConsentStorageKey('user-a'),
      JSON.stringify({
        connectionId: 'conn-1',
        consentedProvider: 'https-evil.example',
        consentedAt: '2026-01-01T00:00:00Z',
      }),
    );

    expect(readAskConsent('user-a')).toBeNull();
  });

  it('isolates consent per user and clears on demand', () => {
    configure('user-a');
    expect(resolveAskByok('user-b')).toBeNull();

    clearAskConsent('user-a');
    expect(resolveAskByok('user-a')).toBeNull();
    expect(localStorage.getItem(askConsentStorageKey('user-a'))).toBeNull();
  });
});

describe('ask byok resolution follows the connection library', () => {
  it('serves the rotated key instead of the one present at consent time', () => {
    const record = configure('user-a');
    expect(resolveAskByok('user-a')?.providerKey).toBe('sk-original-123456');

    // 轮换后连接回到未探测状态：旧 key 必须立刻停止使用。
    writeAiConnections('user-a', [
      { ...record, apiKey: 'sk-rotated-999999', status: 'untested', generationCapability: null },
    ]);
    expect(resolveAskByok('user-a')).toBeNull();

    // 重新探测通过后，解析到的是新 key，绝不会是旧 key。
    writeAiConnections('user-a', [
      {
        ...record,
        apiKey: 'sk-rotated-999999',
        status: 'valid',
        generationCapability: { ok: true, model: 'deepseek-chat', testedAt: 'now', reason: null },
      },
    ]);
    expect(resolveAskByok('user-a')?.providerKey).toBe('sk-rotated-999999');
  });

  it('stops resolving once the active connection is disabled', () => {
    const record = configure('user-a');

    writeAiConnections('user-a', [{ ...record, status: 'disabled' }]);

    expect(resolveAskByok('user-a')).toBeNull();
  });

  it('stops resolving once the active connection is deleted', () => {
    configure('user-a');

    writeAiConnections('user-a', []);

    expect(resolveAskByok('user-a')).toBeNull();
  });

  it('requires fresh consent when the connection switches provider', () => {
    const record = configure('user-a');

    writeAiConnections('user-a', [{ ...record, adapter: 'openai' }]);

    expect(resolveAskByok('user-a')).toBeNull();
  });

  it('refuses connections that never passed a probe', () => {
    configure('user-a', { status: 'valid', generationCapability: { ok: false, reason: 'bad' } });

    expect(resolveAskByok('user-a')).toBeNull();
  });

  it('re-renders subscribers when the connection library changes', async () => {
    const record = configure('user-a');
    await act(async () => root.render(<Harness userId="user-a" />));
    expect(container.querySelector('[data-testid="key"]')?.textContent).toBe('sk-original-123456');

    await act(async () => {
      writeAiConnections('user-a', [{ ...record, status: 'disabled' }]);
    });
    expect(container.querySelector('[data-testid="key"]')?.textContent).toBe('none');
  });

  it('re-renders subscribers when consent is revoked', async () => {
    configure('user-a');
    await act(async () => root.render(<Harness userId="user-a" />));
    expect(container.querySelector('[data-testid="key"]')?.textContent).toBe('sk-original-123456');

    await act(async () => {
      clearAskConsent('user-a');
    });
    expect(container.querySelector('[data-testid="key"]')?.textContent).toBe('none');
  });
});
