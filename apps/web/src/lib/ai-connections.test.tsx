// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest';
import {
  aiConnectionsStorageKey,
  aiSettingsStorageKey,
  clearAiConnectionsState,
  readAiConnections,
  readAiSettings,
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
      includeNotesInAi: true,
    });

    writeAiSettings(USER, { generationConnectionId: 'conn-1', includeNotesInAi: false });
    expect(readAiSettings(USER)).toEqual({
      generationConnectionId: 'conn-1',
      selectedModel: null,
      includeNotesInAi: false,
    });
    expect(localStorage.getItem(aiSettingsStorageKey(USER))).toContain('conn-1');

    localStorage.setItem(aiSettingsStorageKey(USER), '{not json');
    clearAiConnectionsState();
    expect(readAiSettings(USER).includeNotesInAi).toBe(true);
  });
});
