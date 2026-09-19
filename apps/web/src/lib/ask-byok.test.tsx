// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  askByokStorageKey,
  clearAskByok,
  readAskByok,
  resetAskByokState,
  saveAskByok,
  useAskByok,
} from './ask-byok';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function Harness({ userId }: { userId: string }) {
  return <span data-testid="configured">{useAskByok(userId) ? 'yes' : 'no'}</span>;
}

beforeEach(() => {
  localStorage.clear();
  resetAskByokState();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

describe('ask byok storage', () => {
  it('returns null when nothing is stored', () => {
    expect(readAskByok('user-a')).toBeNull();
  });

  it('round-trips a saved config with consent metadata', () => {
    saveAskByok('user-a', { provider: 'deepseek', model: 'deepseek-chat', providerKey: 'sk-abc' });

    const stored = readAskByok('user-a');
    expect(stored).toMatchObject({
      provider: 'deepseek',
      model: 'deepseek-chat',
      providerKey: 'sk-abc',
      consentedProvider: 'deepseek',
    });
    expect(stored?.consentedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(JSON.parse(localStorage.getItem(askByokStorageKey('user-a')) ?? '{}')).toMatchObject({
      provider: 'deepseek',
    });
  });

  it('rejects stored payloads with unknown providers or mismatched consent', () => {
    localStorage.setItem(
      askByokStorageKey('user-a'),
      JSON.stringify({
        provider: 'https-evil.example',
        model: 'm',
        providerKey: 'k',
        consentedAt: '2026-01-01T00:00:00Z',
        consentedProvider: 'https-evil.example',
      }),
    );
    expect(readAskByok('user-a')).toBeNull();

    localStorage.setItem(
      askByokStorageKey('user-b'),
      JSON.stringify({
        provider: 'openai',
        model: 'gpt-4o-mini',
        providerKey: 'k',
        consentedAt: '2026-01-01T00:00:00Z',
        consentedProvider: 'deepseek',
      }),
    );
    expect(readAskByok('user-b')).toBeNull();
  });

  it('isolates configs per user and clears on demand', () => {
    saveAskByok('user-a', { provider: 'groq', model: 'llama', providerKey: 'gsk-key' });

    expect(readAskByok('user-b')).toBeNull();

    clearAskByok('user-a');
    expect(readAskByok('user-a')).toBeNull();
    expect(localStorage.getItem(askByokStorageKey('user-a'))).toBeNull();
  });

  it('reflects storage changes in subscribed components', async () => {
    await act(async () => root.render(<Harness userId="user-a" />));
    expect(container.querySelector('[data-testid="configured"]')?.textContent).toBe('no');

    await act(async () => {
      saveAskByok('user-a', { provider: 'openai', model: 'gpt-4o-mini', providerKey: 'sk-key' });
    });
    expect(container.querySelector('[data-testid="configured"]')?.textContent).toBe('yes');

    await act(async () => {
      clearAskByok('user-a');
    });
    expect(container.querySelector('[data-testid="configured"]')?.textContent).toBe('no');
  });
});
