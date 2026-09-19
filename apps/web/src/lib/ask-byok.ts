import { type AskProviderId, findAskProvider } from '@asterism/core';
import { useSyncExternalStore } from 'react';

/**
 * Ask Asterism 的 BYOK 配置存储（ADR 0042）：Provider key 只存当前用户浏览器的
 * localStorage（按用户隔离、版本化键），服务端零存储。写入仅发生在用户通过
 * 出网披露对话框确认同意之后；`consentedProvider` 记录同意时的 Provider，
 * 更换 Provider 需要重新确认。
 */
export interface AskByokConfig {
  provider: AskProviderId;
  model: string;
  providerKey: string;
  /** 显式同意的 ISO 时间戳。 */
  consentedAt: string;
  /** 同意时所选的 Provider；与 provider 不一致视为未同意。 */
  consentedProvider: AskProviderId;
}

const cache = new Map<string, AskByokConfig | null>();
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

export function askByokStorageKey(userId: string) {
  return `asterism:ask-byok:v1:${userId}`;
}

function parseStoredConfig(raw: string | null): AskByokConfig | null {
  if (!raw) {
    return null;
  }
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const provider = value.provider;
    const model = value.model;
    const providerKey = value.providerKey;
    const consentedAt = value.consentedAt;
    const consentedProvider = value.consentedProvider;
    if (
      typeof provider !== 'string' ||
      !findAskProvider(provider) ||
      typeof model !== 'string' ||
      model.length === 0 ||
      typeof providerKey !== 'string' ||
      providerKey.length === 0 ||
      typeof consentedAt !== 'string' ||
      consentedAt.length === 0 ||
      consentedProvider !== provider
    ) {
      return null;
    }
    return {
      provider,
      model,
      providerKey,
      consentedAt,
      consentedProvider,
    } as AskByokConfig;
  } catch {
    return null;
  }
}

export function readAskByok(userId: string): AskByokConfig | null {
  if (cache.has(userId)) {
    return cache.get(userId) ?? null;
  }
  let config: AskByokConfig | null = null;
  try {
    config = parseStoredConfig(window.localStorage.getItem(askByokStorageKey(userId)));
  } catch {
    // Storage restrictions keep Ask unconfigured for this session.
  }
  cache.set(userId, config);
  return config;
}

/** 保存配置。调用方负责先完成出网披露与同意；此处只落盘。 */
export function saveAskByok(
  userId: string,
  config: Omit<AskByokConfig, 'consentedAt' | 'consentedProvider'> & {
    consentedAt?: string;
    consentedProvider?: AskProviderId;
  },
): AskByokConfig {
  const consentedAt = config.consentedAt ?? new Date().toISOString();
  const stored: AskByokConfig = {
    ...config,
    consentedAt,
    consentedProvider: config.consentedProvider ?? config.provider,
  };
  try {
    window.localStorage.setItem(askByokStorageKey(userId), JSON.stringify(stored));
  } catch {
    // In-memory config keeps Ask usable for this session.
  }
  cache.set(userId, stored);
  emitChange();
  return stored;
}

export function clearAskByok(userId: string) {
  try {
    window.localStorage.removeItem(askByokStorageKey(userId));
  } catch {
    // Clearing in-memory state still disables Ask for this session.
  }
  cache.set(userId, null);
  emitChange();
}

export function useAskByok(userId: string | undefined): AskByokConfig | null {
  return useSyncExternalStore(
    subscribe,
    () => (userId ? readAskByok(userId) : null),
    () => null,
  );
}

export function resetAskByokState() {
  cache.clear();
  emitChange();
}
