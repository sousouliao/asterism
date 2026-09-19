import { type AskProviderId, findAskProvider } from '@asterism/core';
import { useSyncExternalStore } from 'react';

/**
 * 生成连接的浏览器本地存储（ADR 0043）：旧 Provider Registry 的受信服务端凭据库
 * 已被 ADR 0032 退役，这里以「按用户隔离、版本化 localStorage 键」重建同一连接模型
 * （具名连接 + 状态 + 最近探针结论），key 明文只存本浏览器，与 ask-byok 同一信任
 * 边界；服务端仍零存储。字段名（adapter / credentialHint / generationCapability）
 * 沿用旧投影，使还原的连接管理界面无需改写。
 */
export type AiConnectionStatus = 'untested' | 'valid' | 'invalid' | 'disabled';

export interface AiConnection {
  id: string;
  adapter: AskProviderId;
  name: string;
  /** 白名单 Provider 恒为 null；保留字段以维持旧界面数据形状。 */
  baseUrl: string | null;
  status: AiConnectionStatus;
  /** 展示用凭据提示（如 `sk-…abcd`）；不含完整 key。 */
  credentialHint: string | null;
  /** BYOK key 明文，仅存本浏览器（ADR 0042 信任边界）。 */
  apiKey: string;
  /** 最近一次探针结论，形状见 core `readGenerationCapability`。 */
  generationCapability: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface AiSettings {
  generationConnectionId: string | null;
  includeNotesInAi: boolean;
}

const connectionsCache = new Map<string, AiConnection[]>();
const settingsCache = new Map<string, AiSettings>();
const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function aiConnectionsStorageKey(userId: string) {
  return `asterism:ai-connections:v1:${userId}`;
}

export function aiSettingsStorageKey(userId: string) {
  return `asterism:ai-settings:v1:${userId}`;
}

const STATUSES = new Set<AiConnectionStatus>(['untested', 'valid', 'invalid', 'disabled']);

function parseConnection(value: Record<string, unknown>): AiConnection | null {
  const adapter = value.adapter;
  if (
    typeof value.id !== 'string' ||
    typeof adapter !== 'string' ||
    !findAskProvider(adapter) ||
    typeof value.name !== 'string' ||
    typeof value.apiKey !== 'string' ||
    typeof value.status !== 'string' ||
    !STATUSES.has(value.status as AiConnectionStatus)
  ) {
    return null;
  }
  return {
    id: value.id,
    adapter: adapter as AskProviderId,
    name: value.name,
    baseUrl: null,
    status: value.status as AiConnectionStatus,
    credentialHint: typeof value.credentialHint === 'string' ? value.credentialHint : null,
    apiKey: value.apiKey,
    generationCapability: 'generationCapability' in value ? value.generationCapability : null,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
  };
}

function readRawConnections(userId: string): AiConnection[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(aiConnectionsStorageKey(userId));
  } catch {
    // Storage restrictions keep the library empty for this session.
  }
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((entry) =>
        entry !== null && typeof entry === 'object'
          ? parseConnection(entry as Record<string, unknown>)
          : null,
      )
      .filter((entry): entry is AiConnection => entry !== null);
  } catch {
    return [];
  }
}

export function readAiConnections(userId: string): AiConnection[] {
  if (connectionsCache.has(userId)) {
    return connectionsCache.get(userId) ?? [];
  }
  const connections = readRawConnections(userId);
  connectionsCache.set(userId, connections);
  return connections;
}

export function writeAiConnections(userId: string, connections: AiConnection[]) {
  try {
    window.localStorage.setItem(aiConnectionsStorageKey(userId), JSON.stringify(connections));
  } catch {
    // In-memory connections keep the manager usable for this session.
  }
  connectionsCache.set(userId, connections);
  emitChange();
}

export function readAiSettings(userId: string): AiSettings {
  if (settingsCache.has(userId)) {
    return settingsCache.get(userId) ?? defaultAiSettings();
  }
  let settings = defaultAiSettings();
  try {
    const raw = window.localStorage.getItem(aiSettingsStorageKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      settings = {
        generationConnectionId:
          typeof parsed.generationConnectionId === 'string' ? parsed.generationConnectionId : null,
        includeNotesInAi: parsed.includeNotesInAi !== false,
      };
    }
  } catch {
    // Storage restrictions fall back to defaults for this session.
  }
  settingsCache.set(userId, settings);
  return settings;
}

export function writeAiSettings(userId: string, settings: AiSettings) {
  try {
    window.localStorage.setItem(aiSettingsStorageKey(userId), JSON.stringify(settings));
  } catch {
    // In-memory settings keep preferences usable for this session.
  }
  settingsCache.set(userId, settings);
  emitChange();
}

/** 与 ADR 0042 的同意范围一致：默认带入 Memory 笔记，用户可在此关闭。 */
export function defaultAiSettings(): AiSettings {
  return { generationConnectionId: null, includeNotesInAi: true };
}

export function clearAiConnectionsState() {
  connectionsCache.clear();
  settingsCache.clear();
  emitChange();
}

/** 供非 React 调用方订阅连接库变化（ask 配置激活时同步 ask-byok 后广播）。 */
export function subscribeAiConnections(listener: () => void) {
  return subscribe(listener);
}

export function useAiSettingsValue(userId: string | undefined): AiSettings {
  return useSyncExternalStore(
    subscribe,
    () => (userId ? readAiSettings(userId) : defaultAiSettings()),
    defaultAiSettings,
  );
}
