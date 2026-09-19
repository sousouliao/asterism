import { describe, expect, it, vi } from 'vitest';
import { type AskGenerateDependencies, createAskGenerateHandler } from './handler';

function providerSuccess(content = '{"summary":"ok","recommendations":[0]}') {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function dependencies(overrides: Partial<AskGenerateDependencies> = {}): AskGenerateDependencies {
  return {
    authenticate: vi.fn().mockResolvedValue('user-1'),
    fetchProvider: vi.fn().mockResolvedValue(providerSuccess()),
    ...overrides,
  };
}

function request(body: Record<string, unknown>, authorized = true) {
  return new Request('https://example.test/ask-generate', {
    method: 'POST',
    headers: authorized
      ? { Authorization: 'Bearer session-jwt', 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function validBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
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

async function outcome(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe('ask-generate HTTP boundary', () => {
  it('rejects missing and invalid sessions before touching the provider', async () => {
    const missing = await createAskGenerateHandler(dependencies())(request(validBody(), false));
    expect(missing.status).toBe(401);

    const invalid = dependencies({ authenticate: vi.fn().mockResolvedValue(null) });
    const invalidResponse = await createAskGenerateHandler(invalid)(request(validBody()));
    expect(invalidResponse.status).toBe(401);
    expect(invalid.fetchProvider).not.toHaveBeenCalled();
  });

  it('forwards only allowlisted providers and rejects unknown base urls', async () => {
    const deps = dependencies();
    const response = await createAskGenerateHandler(deps)(
      request(validBody({ provider: 'https-evil.example' })),
    );
    expect(response.status).toBe(400);
    expect(deps.fetchProvider).not.toHaveBeenCalled();

    const ok = await createAskGenerateHandler(deps)(request(validBody()));
    expect(ok.status).toBe(200);
    const url = (deps.fetchProvider as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(url).toBe('https://api.deepseek.com/chat/completions');
  });

  it('validates model ids, keys, roles and message sizes', async () => {
    const deps = dependencies();
    const cases: Record<string, unknown>[] = [
      validBody({ model: 'bad model!' }),
      validBody({ model: '' }),
      validBody({ providerKey: 'short' }),
      validBody({ messages: [] }),
      validBody({ messages: [{ role: 'tool', content: 'hi' }] }),
      validBody({ messages: [{ role: 'user', content: '' }] }),
      validBody({ temperature: 5 }),
      validBody({ responseFormat: 'yaml' }),
    ];
    for (const body of cases) {
      const response = await createAskGenerateHandler(deps)(request(body));
      expect(response.status).toBe(400);
    }
    expect(deps.fetchProvider).not.toHaveBeenCalled();
  });

  it('forwards the provider key only to the upstream request and maps success content', async () => {
    const deps = dependencies();
    const response = await createAskGenerateHandler(deps)(
      request(validBody({ responseFormat: 'json_object' })),
    );
    expect(response.status).toBe(200);
    await expect(outcome(response)).resolves.toEqual({
      status: 'success',
      content: '{"summary":"ok","recommendations":[0]}',
    });

    const call = (deps.fetchProvider as ReturnType<typeof vi.fn>).mock.calls[0];
    const init = call?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer sk-test-key-123456');
    expect(JSON.parse(String(init.body))).toEqual({
      model: 'deepseek-chat',
      messages: validBody().messages,
      response_format: { type: 'json_object' },
    });
  });

  it('maps upstream 401 to invalid_provider_key without leaking the key', async () => {
    const deps = dependencies({
      fetchProvider: vi.fn().mockResolvedValue(new Response('unauthorized', { status: 401 })),
    });
    const response = await createAskGenerateHandler(deps)(request(validBody()));
    expect(response.status).toBe(200);
    const body = await outcome(response);
    expect(body).toEqual({ status: 'invalid_provider_key' });
    expect(JSON.stringify(body)).not.toContain('sk-test-key');
  });

  it('maps rate limits and other upstream failures to provider_rejected', async () => {
    const deps = dependencies({
      fetchProvider: vi.fn().mockResolvedValue(new Response('slow down', { status: 429 })),
    });
    const response = await createAskGenerateHandler(deps)(request(validBody()));
    await expect(outcome(response)).resolves.toEqual({
      status: 'provider_rejected',
      upstreamStatus: 429,
    });
  });

  it('maps network failures to retryable_error and timeouts to 504', async () => {
    const networkDeps = dependencies({
      fetchProvider: vi.fn().mockRejectedValue(new Error('dns')),
    });
    const networkResponse = await createAskGenerateHandler(networkDeps)(request(validBody()));
    expect(networkResponse.status).toBe(502);
    await expect(outcome(networkResponse)).resolves.toEqual({ status: 'retryable_error' });

    const never = new Promise<Response>((_, reject) => {
      const timer = setTimeout(() => reject(new DOMException('timed out', 'TimeoutError')), 50);
      return () => clearTimeout(timer);
    });
    const timeoutDeps = dependencies({
      fetchProvider: vi.fn().mockReturnValue(never),
      timeoutMs: 5,
    });
    const timeoutResponse = await createAskGenerateHandler(timeoutDeps)(request(validBody()));
    expect(timeoutResponse.status).toBe(504);
  });

  it('rejects malformed upstream payloads', async () => {
    const deps = dependencies({
      fetchProvider: vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ choices: [{ message: {} }] }), { status: 200 }),
        ),
    });
    const response = await createAskGenerateHandler(deps)(request(validBody()));
    expect(response.status).toBe(502);
    await expect(outcome(response)).resolves.toEqual({ status: 'retryable_error' });
  });
});
