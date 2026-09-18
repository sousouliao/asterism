import { DEFAULT_EMBEDDING_MODEL } from '@asterism/core';
import { useSyncExternalStore } from 'react';

export type EmbeddingAvailability = 'disabled' | 'preparing' | 'available' | 'degraded';

const consentCache = new Map<string, boolean>();
const preparationState = new Map<
  string,
  {
    availability: Exclude<EmbeddingAvailability, 'disabled'>;
    token: symbol;
  }
>();
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

export function embeddingOptInStorageKey(userId: string) {
  return `asterism:embedding-bootstrap:v2:${userId}:${DEFAULT_EMBEDDING_MODEL}`;
}

export function embeddingPromptDismissalStorageKey(userId: string) {
  return `asterism:embedding-prompt-dismissed:v1:${userId}:${DEFAULT_EMBEDDING_MODEL}`;
}

export function readEmbeddingPromptDismissal(userId: string): boolean {
  try {
    return localStorage.getItem(embeddingPromptDismissalStorageKey(userId)) === 'dismissed';
  } catch {
    return false;
  }
}

export function dismissEmbeddingPrompt(userId: string) {
  try {
    localStorage.setItem(embeddingPromptDismissalStorageKey(userId), 'dismissed');
  } catch {
    // The prompt remains dismissible for the current mounted search surface.
  }
}

export function readEmbeddingConsent(userId: string): boolean {
  const cached = consentCache.get(userId);
  if (cached !== undefined) {
    return cached;
  }

  let consented = false;
  try {
    consented = localStorage.getItem(embeddingOptInStorageKey(userId)) === 'enabled';
  } catch {
    // Storage restrictions degrade semantic features without affecting keyword search.
  }
  consentCache.set(userId, consented);
  return consented;
}

export function beginEmbeddingPreparation(userId: string, rememberChoice: boolean) {
  if (rememberChoice) {
    try {
      localStorage.setItem(embeddingOptInStorageKey(userId), 'enabled');
    } catch {
      // In-memory consent still keeps the current preparation run usable.
    }
    consentCache.set(userId, true);
  }
  const token = Symbol(userId);
  preparationState.set(userId, { availability: 'preparing', token });
  emitChange();
  return token;
}

export function finishEmbeddingPreparation(userId: string, token: symbol, succeeded: boolean) {
  if (preparationState.get(userId)?.token !== token) {
    return;
  }
  preparationState.set(userId, {
    availability: succeeded ? 'available' : 'degraded',
    token,
  });
  emitChange();
}

export function clearEmbeddingConsent(userId: string) {
  try {
    localStorage.removeItem(embeddingOptInStorageKey(userId));
  } catch {
    // Clearing the in-memory state still disables semantic search for this session.
  }
  consentCache.set(userId, false);
  preparationState.delete(userId);
  emitChange();
}

function getAvailability(userId: string | undefined): EmbeddingAvailability {
  if (!(userId && readEmbeddingConsent(userId))) {
    return 'disabled';
  }
  return preparationState.get(userId)?.availability ?? 'preparing';
}

export function useEmbeddingConsent(userId: string | undefined): boolean {
  return useSyncExternalStore(
    subscribe,
    () => Boolean(userId && readEmbeddingConsent(userId)),
    () => false,
  );
}

export function useEmbeddingAvailability(userId: string | undefined): EmbeddingAvailability {
  return useSyncExternalStore(
    subscribe,
    () => getAvailability(userId),
    () => 'disabled',
  );
}

export function resetEmbeddingConsentState() {
  consentCache.clear();
  preparationState.clear();
  emitChange();
}
