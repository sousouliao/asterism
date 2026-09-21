import { FunctionsHttpError } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { type AskGenerateRequest, invokeAskModels, invokeAskTest, streamAskGenerate } from './ask';
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

describe('streamAskGenerate', () => {
  it('forwards the byok request body and preserves a successful json fallback', async () => {
    const { client, invoke } = clientReturning({
      status: 'success',
      content: 'Hello from Ask.',
    });
    const onDelta = vi.fn();

    await expect(streamAskGenerate(client, request(), { onDelta })).resolves.toEqual({
      status: 'success',
      content: 'Hello from Ask.',
    });
    expect(onDelta).toHaveBeenCalledWith('Hello from Ask.');
    expect(invoke).toHaveBeenCalledWith('ask-generate', {
      body: {
        provider: 'deepseek',
        model: 'deepseek-chat',
        providerKey: 'sk-test-key-123456',
        messages: request().messages,
      },
      signal: undefined,
    });
  });

  it('consumes an SSE response and forwards each delta', async () => {
    const sse =
      'event: delta\ndata: {"text":"Hel"}\n\nevent: delta\ndata: {"text":"lo"}\n\nevent: done\ndata: {}\n\n';
    const { client } = clientReturning(
      new Response(sse, { headers: { 'Content-Type': 'text/event-stream' } }),
    );
    const onDelta = vi.fn();
    await expect(streamAskGenerate(client, request(), { onDelta })).resolves.toEqual({
      status: 'success',
      content: 'Hello',
    });
    expect(onDelta.mock.calls.map((call) => call[0])).toEqual(['Hel', 'lo']);
  });

  it('surfaces an in-stream timeout error event', async () => {
    const sse = 'event: error\ndata: {"status":"timeout"}\n\nevent: done\ndata: {}\n\n';
    const { client } = clientReturning(
      new Response(sse, { headers: { 'Content-Type': 'text/event-stream' } }),
    );
    await expect(streamAskGenerate(client, request(), { onDelta: vi.fn() })).resolves.toEqual({
      status: 'timeout',
    });
  });

  it.each([
    'invalid_provider_key',
    'provider_rejected',
    'retryable_error',
  ] as const)('preserves the %s typed outcome', async (status) => {
    const { client } = clientReturning({ status });
    await expect(streamAskGenerate(client, request(), { onDelta: vi.fn() })).resolves.toEqual({
      status,
    });
  });

  it('maps gateway timeouts to the timeout outcome', async () => {
    const error = new FunctionsHttpError(new Response('timed out', { status: 504 }));
    const { client } = clientFailing(error);
    await expect(streamAskGenerate(client, request(), { onDelta: vi.fn() })).resolves.toEqual({
      status: 'timeout',
    });
  });

  it('collapses transport failures and malformed envelopes into retryable errors', async () => {
    const { client: networkClient } = clientFailing(new Error('network down'));
    await expect(
      streamAskGenerate(networkClient, request(), { onDelta: vi.fn() }),
    ).resolves.toEqual({
      status: 'retryable_error',
    });

    const { client: malformedClient } = clientReturning({ nonsense: true });
    await expect(
      streamAskGenerate(malformedClient, request(), { onDelta: vi.fn() }),
    ).resolves.toEqual({
      status: 'retryable_error',
    });
  });

  it('throws when the caller has already aborted', async () => {
    const { client } = clientReturning({ status: 'success', content: 'Hello' });
    const controller = new AbortController();
    controller.abort();
    await expect(
      streamAskGenerate(client, request(), { onDelta: vi.fn(), signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
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
