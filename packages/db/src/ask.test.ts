import { FunctionsHttpError } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { type AskGenerateRequest, invokeAskGenerate } from './ask';
import type { SupabaseClient } from './client';

function clientReturning(data: unknown) {
  const invoke = vi.fn().mockResolvedValue({ data, error: null });
  return { client: { functions: { invoke } } as unknown as SupabaseClient, invoke };
}

function clientFailing(error: unknown) {
  const invoke = vi.fn().mockResolvedValue({ data: null, error });
  return { client: { functions: { invoke } } as unknown as SupabaseClient, invoke };
}

function request(overrides: Partial<AskGenerateRequest> = {}): AskGenerateRequest {
  return {
    provider: 'deepseek',
    model: 'deepseek-chat',
    providerKey: 'sk-test-key-123456',
    messages: [
      { role: 'system', content: 'You are Ask Asterism.' },
      { role: 'user', content: 'Question: websocket libs?' },
    ],
    ...overrides,
  };
}

describe('invokeAskGenerate', () => {
  it('forwards the byok request body and preserves a successful outcome', async () => {
    const { client, invoke } = clientReturning({
      status: 'success',
      content: '{"summary":"ok"}',
    });

    await expect(invokeAskGenerate(client, request())).resolves.toEqual({
      status: 'success',
      content: '{"summary":"ok"}',
    });
    expect(invoke).toHaveBeenCalledWith('ask-generate', {
      body: {
        provider: 'deepseek',
        model: 'deepseek-chat',
        providerKey: 'sk-test-key-123456',
        messages: request().messages,
      },
    });
  });

  it('includes the json response format only when requested', async () => {
    const { client, invoke } = clientReturning({ status: 'success', content: '{}' });

    await invokeAskGenerate(client, request({ responseFormat: 'json_object' }));

    expect(invoke).toHaveBeenCalledWith('ask-generate', {
      body: expect.objectContaining({ responseFormat: 'json_object' }),
    });
  });

  it.each([
    'invalid_provider_key',
    'provider_rejected',
    'retryable_error',
  ] as const)('preserves the %s typed outcome', async (status) => {
    const { client } = clientReturning({ status });
    await expect(invokeAskGenerate(client, request())).resolves.toEqual({ status });
  });

  it('maps gateway timeouts to the timeout outcome', async () => {
    const error = new FunctionsHttpError(new Response('timed out', { status: 504 }));
    const { client } = clientFailing(error);
    await expect(invokeAskGenerate(client, request())).resolves.toEqual({ status: 'timeout' });
  });

  it('collapses transport failures and malformed envelopes into retryable errors', async () => {
    const { client: networkClient } = clientFailing(new Error('network down'));
    await expect(invokeAskGenerate(networkClient, request())).resolves.toEqual({
      status: 'retryable_error',
    });

    const { client: malformedClient } = clientReturning({ nonsense: true });
    await expect(invokeAskGenerate(malformedClient, request())).resolves.toEqual({
      status: 'retryable_error',
    });
  });
});
