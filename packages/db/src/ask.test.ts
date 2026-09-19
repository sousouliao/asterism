import { FunctionsHttpError } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { type AskGenerateRequest, invokeAskGenerate, invokeAskModels, invokeAskTest } from './ask';
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

describe('invokeAskModels', () => {
  it('sends the models action with the draft credentials and preserves the model list', async () => {
    const { client, invoke } = clientReturning({
      status: 'success',
      models: ['deepseek-chat', 'deepseek-reasoner'],
    });

    await expect(
      invokeAskModels(client, { provider: 'deepseek', providerKey: 'sk-test-key-123456' }),
    ).resolves.toEqual({ status: 'success', models: ['deepseek-chat', 'deepseek-reasoner'] });
    expect(invoke).toHaveBeenCalledWith('ask-generate', {
      body: { action: 'models', provider: 'deepseek', providerKey: 'sk-test-key-123456' },
    });
  });

  it('preserves the invalid key outcome for an actionable hint', async () => {
    const { client } = clientReturning({ status: 'invalid_provider_key' });
    await expect(
      invokeAskModels(client, { provider: 'deepseek', providerKey: 'sk-test-key-123456' }),
    ).resolves.toEqual({ status: 'invalid_provider_key' });
  });

  it('collapses transport failures, upstream rejects and malformed envelopes into unavailable', async () => {
    const { client: networkClient } = clientFailing(new Error('network down'));
    await expect(
      invokeAskModels(networkClient, { provider: 'deepseek', providerKey: 'sk-test-key-123456' }),
    ).resolves.toEqual({ status: 'unavailable' });

    const { client: rejectedClient } = clientReturning({ status: 'retryable_error' });
    await expect(
      invokeAskModels(rejectedClient, { provider: 'deepseek', providerKey: 'sk-test-key-123456' }),
    ).resolves.toEqual({ status: 'unavailable' });

    const { client: malformedClient } = clientReturning({ models: 'nope' });
    await expect(
      invokeAskModels(malformedClient, { provider: 'deepseek', providerKey: 'sk-test-key-123456' }),
    ).resolves.toEqual({ status: 'unavailable' });
  });
});

describe('invokeAskTest', () => {
  const testRequest = {
    provider: 'deepseek',
    model: 'deepseek-chat',
    providerKey: 'sk-test-key-123456',
  };

  it('sends the test action and reports a passed probe', async () => {
    const { client, invoke } = clientReturning({ status: 'success', ok: true, reason: null });

    await expect(invokeAskTest(client, testRequest)).resolves.toEqual({ status: 'passed' });
    expect(invoke).toHaveBeenCalledWith('ask-generate', {
      body: {
        action: 'test',
        provider: 'deepseek',
        model: 'deepseek-chat',
        providerKey: 'sk-test-key-123456',
      },
    });
  });

  it('maps unauthorized keys and format failures to typed reasons', async () => {
    const { client: keyClient } = clientReturning({ status: 'invalid_provider_key' });
    await expect(invokeAskTest(keyClient, testRequest)).resolves.toEqual({
      status: 'failed',
      reason: 'unauthorized',
    });

    const { client: formatClient } = clientReturning({
      status: 'success',
      ok: false,
      reason: 'empty_response',
    });
    await expect(invokeAskTest(formatClient, testRequest)).resolves.toEqual({
      status: 'failed',
      reason: 'empty_response',
    });
  });

  it('collapses transport failures into unavailable', async () => {
    const { client } = clientFailing(new Error('network down'));
    await expect(invokeAskTest(client, testRequest)).resolves.toEqual({ status: 'unavailable' });
  });
});
