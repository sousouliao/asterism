import { type AskProviderId, findAskProvider, readTestedModel } from '@asterism/core';
import { useSyncExternalStore } from 'react';
import { type AiConnection, readAiConnections, subscribeAiConnections } from './ai-connections';

/**
 * Ask Asterism 的出网同意存储（ADR 0042）。
 *
 * 这里**只**持久化「用户对哪条连接、哪个 Provider 表示过出网同意」，不再保存
 * Provider key 的第二份副本。key、model 与 Provider 在每次使用时由 `resolveAskByok`
 * 从连接库（ADR 0043）现取，因此轮换 key、停用连接或更换 Provider 立即生效，
 * 不存在两份状态需要手工同步的窗口。
 */
export interface AskConsent {
  /** 同意针对的连接；连接被删除即视为未同意。 */
  connectionId: string;
  /** 同意时所选的 Provider；与连接当前 Provider 不一致需重新确认。 */
  consentedProvider: AskProviderId;
  /** 显式同意的 ISO 时间戳。 */
  consentedAt: string;
}

/** 运行时解析出的可用配置；不落盘，key 永远来自连接库当前值。 */
export interface AskByokConfig {
  connectionId: string;
  provider: AskProviderId;
  model: string;
  providerKey: string;
  consentedAt: string;
}

const consentCache = new Map<string, AskConsent | null>();
const resolvedCache = new Map<string, AskByokConfig | null>();
const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

// 连接库变化（改 key、停用、删除）必须让已解析的配置失效，否则 Ask 会继续
// 使用上一次解析出的凭据——这正是单一真相源要消除的问题。
subscribeAiConnections(() => {
  resolvedCache.clear();
  emitChange();
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function askConsentStorageKey(userId: string) {
  return `asterism:ask-consent:v2:${userId}`;
}

/** v1 键里存过明文 key 的快照；读取时顺手清除，避免旧副本长期留在浏览器。 */
function purgeLegacyByokSnapshot(userId: string) {
  try {
    window.localStorage.removeItem(`asterism:ask-byok:v1:${userId}`);
  } catch {
    // Storage restrictions leave the legacy key untouched; it is never read again.
  }
}

function parseStoredConsent(raw: string | null): AskConsent | null {
  if (!raw) {
    return null;
  }
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const { connectionId, consentedProvider, consentedAt } = value;
    if (
      typeof connectionId !== 'string' ||
      connectionId.length === 0 ||
      typeof consentedProvider !== 'string' ||
      !findAskProvider(consentedProvider) ||
      typeof consentedAt !== 'string' ||
      consentedAt.length === 0
    ) {
      return null;
    }
    return {
      connectionId,
      consentedProvider: consentedProvider as AskProviderId,
      consentedAt,
    };
  } catch {
    return null;
  }
}

export function readAskConsent(userId: string): AskConsent | null {
  if (consentCache.has(userId)) {
    return consentCache.get(userId) ?? null;
  }
  let consent: AskConsent | null = null;
  try {
    purgeLegacyByokSnapshot(userId);
    consent = parseStoredConsent(window.localStorage.getItem(askConsentStorageKey(userId)));
  } catch {
    // Storage restrictions keep Ask unconfigured for this session.
  }
  consentCache.set(userId, consent);
  return consent;
}

/** 记录同意。调用方负责先完成 ADR 0042 的出网披露对话。 */
export function saveAskConsent(
  userId: string,
  input: { connectionId: string; provider: AskProviderId; consentedAt?: string },
): AskConsent {
  const consent: AskConsent = {
    connectionId: input.connectionId,
    consentedProvider: input.provider,
    consentedAt: input.consentedAt ?? new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(askConsentStorageKey(userId), JSON.stringify(consent));
  } catch {
    // In-memory consent keeps Ask usable for this session.
  }
  consentCache.set(userId, consent);
  resolvedCache.delete(userId);
  emitChange();
  return consent;
}

export function clearAskConsent(userId: string) {
  try {
    window.localStorage.removeItem(askConsentStorageKey(userId));
  } catch {
    // Clearing in-memory state still disables Ask for this session.
  }
  consentCache.set(userId, null);
  resolvedCache.delete(userId);
  emitChange();
}

function resolveFromConnection(
  consent: AskConsent,
  connection: AiConnection | undefined,
): AskByokConfig | null {
  // 连接被删除、Provider 被换成未同意的一方、或连接未通过探针（含改 key 后回到
  // untested、以及被显式停用）时，一律视为不可用：Ask 宁可要求重新配置，
  // 也不能拿着失效或未经同意的凭据出网。
  if (!connection || connection.adapter !== consent.consentedProvider) {
    return null;
  }
  if (connection.status !== 'valid') {
    return null;
  }
  const model = readTestedModel(connection.generationCapability);
  if (!model || connection.apiKey.length === 0) {
    return null;
  }
  return {
    connectionId: connection.id,
    provider: connection.adapter,
    model,
    providerKey: connection.apiKey,
    consentedAt: consent.consentedAt,
  };
}

/**
 * 解析当前可用的 BYOK 配置：同意记录 + 连接库当前状态。任一侧不满足即返回 null。
 * 结果带缓存，缓存在同意或连接库变化时失效，保证 `useSyncExternalStore` 快照稳定。
 */
export function resolveAskByok(userId: string): AskByokConfig | null {
  if (resolvedCache.has(userId)) {
    return resolvedCache.get(userId) ?? null;
  }
  const consent = readAskConsent(userId);
  const resolved = consent
    ? resolveFromConnection(
        consent,
        readAiConnections(userId).find((candidate) => candidate.id === consent.connectionId),
      )
    : null;
  resolvedCache.set(userId, resolved);
  return resolved;
}

export function useAskByok(userId: string | undefined): AskByokConfig | null {
  return useSyncExternalStore(
    subscribe,
    () => (userId ? resolveAskByok(userId) : null),
    () => null,
  );
}

export function resetAskByokState() {
  consentCache.clear();
  resolvedCache.clear();
  emitChange();
}
