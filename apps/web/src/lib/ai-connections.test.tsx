// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest';
import {
  aiConnectionsStorageKey,
  aiSettingsStorageKey,
  clearAiConnectionsState,
  readAiConnections,
  readAiSettings,
  resolveDigestByok,
  writeAiConnections,
  writeAiSettings,
} from './ai-connections';

const USER = 'ai-connections-user';

beforeEach(() => {
  localStorage.clear();
  clearAiConnectionsState();
});

describe('ai-connections local store', () => {
  it('round-trips connections and rejects malformed records', () => {
    expect(readAiConnections(USER)).toEqual([]);

    writeAiConnections(USER, [
      {
        id: 'conn-1',
        adapter: 'deepseek',
        name: 'Personal DeepSeek',
        baseUrl: null,
        status: 'valid',
        credentialHint: 'sk-…abcd',
        apiKey: 'sk-test-key-123456',
        generationCapability: { ok: true, reason: null, model: 'deepseek-chat', testedAt: 'x' },
        createdAt: '2026-09-20T00:00:00.000Z',
        updatedAt: '2026-09-20T00:00:00.000Z',
      },
    ]);
    expect(readAiConnections(USER).map((connection) => connection.name)).toEqual([
      'Personal DeepSeek',
    ]);
    // 明文 key 只落本浏览器（ADR 0042 信任边界），但确实随连接记录持久化。
    expect(localStorage.getItem(aiConnectionsStorageKey(USER))).toContain('sk-test-key-123456');

    localStorage.setItem(aiConnectionsStorageKey(USER), '[{"id":"x","adapter":"nope"}]');
    clearAiConnectionsState();
    expect(readAiConnections(USER)).toEqual([]);
  });

  it('keeps include-notes on by default and persisting overrides', () => {
    expect(readAiSettings(USER)).toEqual({
      generationConnectionId: null,
      selectedModel: null,
      digestModel: null,
      includeNotesInAi: true,
    });

    writeAiSettings(USER, {
      generationConnectionId: 'conn-1',
      includeNotesInAi: false,
      digestModel: 'deepseek-chat',
    });
    expect(readAiSettings(USER)).toEqual({
      generationConnectionId: 'conn-1',
      selectedModel: null,
      digestModel: 'deepseek-chat',
      includeNotesInAi: false,
    });
    expect(localStorage.getItem(aiSettingsStorageKey(USER))).toContain('conn-1');

    localStorage.setItem(aiSettingsStorageKey(USER), '{not json');
    clearAiConnectionsState();
    expect(readAiSettings(USER).includeNotesInAi).toBe(true);
  });

  it('resolves digest byok with configured digestModel or defaults to first available model', () => {
    expect(resolveDigestByok(USER)).toBeNull();

    writeAiConnections(USER, [
      {
        id: 'conn-ds',
        adapter: 'deepseek',
        name: 'DeepSeek',
        baseUrl: null,
        status: 'valid',
        credentialHint: 'sk-…1',
        apiKey: 'sk-ds-key',
        generationCapability: { ok: true, reason: null, model: 'deepseek-chat', testedAt: 'x' },
        models: ['deepseek-chat', 'deepseek-reasoner'],
        createdAt: '2026-09-20T00:00:00.000Z',
        updatedAt: '2026-09-20T00:00:00.000Z',
      },
      {
        id: 'conn-oa',
        adapter: 'openai',
        name: 'OpenAI',
        baseUrl: null,
        status: 'valid',
        credentialHint: 'sk-…2',
        apiKey: 'sk-oa-key',
        generationCapability: { ok: true, reason: null, model: 'gpt-4o', testedAt: 'x' },
        models: ['gpt-4o-mini', 'gpt-4o'],
        createdAt: '2026-09-20T00:00:00.000Z',
        updatedAt: '2026-09-20T00:00:00.000Z',
      },
    ]);

    // 默认回退到首个可用模型（DeepSeek 优先）
    const defaultByok = resolveDigestByok(USER);
    expect(defaultByok).toEqual({
      connectionId: 'conn-ds',
      provider: 'deepseek',
      model: 'deepseek-chat',
      providerKey: 'sk-ds-key',
    });

    // 用户在设置中选定特定模型（如 gpt-4o）
    writeAiSettings(USER, { digestModel: 'gpt-4o' });
    const selectedByok = resolveDigestByok(USER);
    expect(selectedByok).toEqual({
      connectionId: 'conn-oa',
      provider: 'openai',
      model: 'gpt-4o',
      providerKey: 'sk-oa-key',
    });

    // 稳定引用测试：数据不变时多次调用必须保持引用同一（供 useSyncExternalStore 杜绝重渲染循环）
    expect(resolveDigestByok(USER)).toBe(selectedByok);
  });
});
