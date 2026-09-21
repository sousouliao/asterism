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
    ];
    for (const body of cases) {
      const response = await createAskGenerateHandler(deps)(request(body));
      expect(response.status).toBe(400);
    }
    expect(deps.fetchProvider).not.toHaveBeenCalled();
  });

  it('forwards the provider key only to the upstream request and streams success content', async () => {
    const deps = dependencies();
    const response = await createAskGenerateHandler(deps)(request(validBody()));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/event-stream');
    expect(await response.text()).toContain('event: delta');

    const call = (deps.fetchProvider as ReturnType<typeof vi.fn>).mock.calls[0];
    const init = call?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer sk-test-key-123456');
    expect(JSON.parse(String(init.body))).toEqual({
      model: 'deepseek-chat',
      messages: validBody().messages,
      max_tokens: 4096,
      stream: true,
    });
    // 白名单只约束首跳，禁止跟随重定向把 Authorization 带出白名单主机。
    expect(init.redirect).toBe('manual');
  });

  it('caps completion tokens so a BYOK quota cannot be drained by one request', async () => {
    const deps = dependencies();
    await createAskGenerateHandler(deps)(request(validBody()));

    const init = (deps.fetchProvider as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(init.body)) as { max_tokens?: unknown };
    expect(body.max_tokens).toBe(4096);
  });

  it('forwards tool messages and tools to the upstream completion', async () => {
    const deps = dependencies();
    const tools = [
      { type: 'function', function: { name: 'expand', parameters: { type: 'object' } } },
    ];
    const response = await createAskGenerateHandler(deps)(
      request(
        validBody({
          messages: [
            { role: 'system', content: 'catalog' },
            {
              role: 'assistant',
              content: '',
              tool_calls: [
                {
                  id: 'c1',
                  type: 'function',
                  function: { name: 'expand', arguments: '{"ids":["a"]}' },
                },
              ],
            },
            { role: 'tool', tool_call_id: 'c1', content: '{"repoId":"a"}' },
          ],
          tools,
        }),
      ),
    );
    expect(response.status).toBe(200);
    const init = (deps.fetchProvider as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.tools).toEqual(tools);
    expect(body.messages).toHaveLength(3);
  });

  it('rejects prototype keys that a naive `in` allowlist check would accept', async () => {
    const deps = dependencies();
    for (const provider of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      const response = await createAskGenerateHandler(deps)(request(validBody({ provider })));
      expect(response.status).toBe(400);
    }
    expect(deps.fetchProvider).not.toHaveBeenCalled();
  });

  it('enforces message count and aggregate size limits', async () => {
    const deps = dependencies();
    const cases: Record<string, unknown>[] = [
      // 超过 MAX_MESSAGES
      validBody({
        messages: Array.from({ length: 81 }, () => ({ role: 'user', content: 'x' })),
      }),
      // 单条超过 MAX_MESSAGE_CHARS
      validBody({ messages: [{ role: 'user', content: 'x'.repeat(250_001) }] }),
      // 合计超过 MAX_TOTAL_CHARS
      validBody({
        messages: Array.from({ length: 3 }, () => ({
          role: 'user',
          content: 'x'.repeat(200_001),
        })),
      }),
    ];
    for (const body of cases) {
      const response = await createAskGenerateHandler(deps)(request(body));
      expect(response.status).toBe(400);
    }
    expect(deps.fetchProvider).not.toHaveBeenCalled();
  });

  it('restricts CORS to configured origins while defaulting to open self-deploy', async () => {
    const open = await createAskGenerateHandler(dependencies())(request(validBody()));
    expect(open.headers.get('Access-Control-Allow-Origin')).toBe('*');

    const scoped = createAskGenerateHandler(
      dependencies({ allowedOrigins: ['https://app.example'] }),
    );
    const allowed = new Request('https://example.test/ask-generate', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer session-jwt',
        'Content-Type': 'application/json',
        Origin: 'https://app.example',
      },
      body: JSON.stringify(validBody()),
    });
    expect((await scoped(allowed)).headers.get('Access-Control-Allow-Origin')).toBe(
      'https://app.example',
    );

    const foreign = new Request('https://example.test/ask-generate', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer session-jwt',
        'Content-Type': 'application/json',
        Origin: 'https://evil.example',
      },
      body: JSON.stringify(validBody()),
    });
    expect((await scoped(foreign)).headers.get('Access-Control-Allow-Origin')).not.toBe(
      'https://evil.example',
    );
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

  it('converts an upstream OpenAI SSE stream into the Asterism event protocol', async () => {
    const upstream = [
      `data: ${JSON.stringify({ choices: [{ delta: { content: 'Hel' } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: 'lo' } }] })}\n\n`,
      'data: [DONE]\n\n',
    ].join('');
    const deps = dependencies({
      fetchProvider: vi.fn().mockResolvedValue(
        new Response(upstream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      ),
    });
    const response = await createAskGenerateHandler(deps)(request(validBody()));
    expect(response.headers.get('Content-Type')).toContain('text/event-stream');
    const body = await response.text();
    expect(body).toContain('event: delta');
    expect(body).toContain('"text":"Hel"');
    expect(body).toContain('"text":"lo"');
    expect(body).toContain('event: done');
  });

  it('converts streamed tool_calls into Asterism tool_call events', async () => {
    const upstream = [
      `data: ${JSON.stringify({
        choices: [
          {
            delta: {
              tool_calls: [{ index: 0, id: 'call_1', function: { name: 'expand', arguments: '' } }],
            },
          },
        ],
      })}\n\n`,
      `data: ${JSON.stringify({
        choices: [
          {
            delta: { tool_calls: [{ index: 0, function: { arguments: '{"ids":["axum"]}' } }] },
            finish_reason: 'tool_calls',
          },
        ],
      })}\n\n`,
      'data: [DONE]\n\n',
    ].join('');
    const deps = dependencies({
      fetchProvider: vi.fn().mockResolvedValue(
        new Response(upstream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      ),
    });
    const response = await createAskGenerateHandler(deps)(request(validBody()));
    const body = await response.text();
    expect(body).toContain('event: tool_call');
    expect(body).toContain('"name":"expand"');
    expect(body).toContain('"arguments":"{\\"ids\\":[\\"axum\\"]}"');
  });

  it('emits a timeout error event when the stream goes idle', async () => {
    const hanging = new Response(
      new ReadableStream<Uint8Array>({
        start() {
          // 故意不 enqueue、不 close：触发空闲超时。
        },
      }),
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
    );
    const deps = dependencies({
      fetchProvider: vi.fn().mockResolvedValue(hanging),
      idleTimeoutMs: 20,
    });
    const response = await createAskGenerateHandler(deps)(request(validBody()));
    const body = await response.text();
    expect(body).toContain('event: error');
    expect(body).toContain('"status":"timeout"');
  });
});

describe('ask-generate models action', () => {
  function modelsBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      action: 'models',
      provider: 'deepseek',
      providerKey: 'sk-test-key-123456',
      ...overrides,
    };
  }

  function modelsSuccess() {
    return new Response(
      JSON.stringify({
        object: 'list',
        data: [{ id: 'deepseek-reasoner' }, { id: 'deepseek-chat' }, { id: 'deepseek-chat' }],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  it('forwards a GET /models request with the provider key and returns a deduped sorted list', async () => {
    const deps = dependencies({ fetchProvider: vi.fn().mockResolvedValue(modelsSuccess()) });
    const response = await createAskGenerateHandler(deps)(request(modelsBody()));
    expect(response.status).toBe(200);
    await expect(outcome(response)).resolves.toEqual({
      status: 'success',
      models: ['deepseek-chat', 'deepseek-reasoner'],
    });

    const call = (deps.fetchProvider as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call?.[0]).toBe('https://api.deepseek.com/models');
    const init = call?.[1] as RequestInit;
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer sk-test-key-123456',
    );
  });

  it('caps the model list to bound the response size', async () => {
    const data = Array.from({ length: 250 }, (_, index) => ({ id: `model-${index}` }));
    const deps = dependencies({
      fetchProvider: vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ data }), { status: 200 })),
    });
    const response = await createAskGenerateHandler(deps)(request(modelsBody()));
    const body = await outcome(response);
    expect((body.models as string[]).length).toBe(200);
  });

  it('keeps generation requests untouched and rejects unknown actions', async () => {
    const deps = dependencies();
    const generate = await createAskGenerateHandler(deps)(request(validBody()));
    expect(generate.status).toBe(200);

    const unknown = await createAskGenerateHandler(deps)(request(modelsBody({ action: 'evil' })));
    expect(unknown.status).toBe(400);
    expect((deps.fetchProvider as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });

  it('validates the provider whitelist and key shape before fetching', async () => {
    const deps = dependencies();
    const cases: Record<string, unknown>[] = [
      modelsBody({ provider: 'https-evil.example' }),
      modelsBody({ providerKey: 'short' }),
    ];
    for (const body of cases) {
      const response = await createAskGenerateHandler(deps)(request(body));
      expect(response.status).toBe(400);
    }
    expect(deps.fetchProvider).not.toHaveBeenCalled();
  });

  it('maps upstream 401 to invalid_provider_key without leaking the key', async () => {
    const deps = dependencies({
      fetchProvider: vi.fn().mockResolvedValue(new Response('denied', { status: 401 })),
    });
    const response = await createAskGenerateHandler(deps)(request(modelsBody()));
    const body = await outcome(response);
    expect(body).toEqual({ status: 'invalid_provider_key' });
    expect(JSON.stringify(body)).not.toContain('sk-test-key');
  });

  it('collapses upstream and transport failures into an empty-handed retryable outcome', async () => {
    const rejected = dependencies({
      fetchProvider: vi.fn().mockResolvedValue(new Response('slow down', { status: 429 })),
    });
    const rejectedResponse = await createAskGenerateHandler(rejected)(request(modelsBody()));
    expect(rejectedResponse.status).toBe(502);
    await expect(outcome(rejectedResponse)).resolves.toEqual({ status: 'retryable_error' });

    const network = dependencies({
      fetchProvider: vi.fn().mockRejectedValue(new Error('dns')),
    });
    const networkResponse = await createAskGenerateHandler(network)(request(modelsBody()));
    expect(networkResponse.status).toBe(502);
  });

  it('returns an empty success list when the payload has no parsable ids', async () => {
    const deps = dependencies({
      fetchProvider: vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ object: 'list', data: [] }), { status: 200 }),
        ),
    });
    const response = await createAskGenerateHandler(deps)(request(modelsBody()));
    await expect(outcome(response)).resolves.toEqual({ status: 'success', models: [] });
  });
});

describe('ask-generate test action', () => {
  function testBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      action: 'test',
      provider: 'deepseek',
      model: 'deepseek-chat',
      providerKey: 'sk-test-key-123456',
      ...overrides,
    };
  }

  it('sends the fixed minimal probe with json mode where supported', async () => {
    const deps = dependencies({
      fetchProvider: vi.fn().mockResolvedValue(providerSuccess('{"ok":true}')),
    });
    const response = await createAskGenerateHandler(deps)(request(testBody()));
    expect(response.status).toBe(200);
    await expect(outcome(response)).resolves.toEqual({
      status: 'success',
      ok: true,
      reason: null,
    });

    const call = (deps.fetchProvider as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call?.[0]).toBe('https://api.deepseek.com/chat/completions');
    const init = call?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'Respond with the JSON object {"ok":true} and nothing else.' },
        { role: 'user', content: 'connection probe' },
      ],
      temperature: 0,
      max_tokens: 512,
      response_format: { type: 'json_object' },
    });
  });

  it('validates provider and model id', async () => {
    const deps = dependencies({
      fetchProvider: vi.fn().mockResolvedValue(providerSuccess('{"ok":true}')),
    });
    const badProvider = await createAskGenerateHandler(deps)(
      request(testBody({ provider: 'unsupported-provider' })),
    );
    expect(badProvider.status).toBe(400);

    const badModel = await createAskGenerateHandler(deps)(
      request(testBody({ model: 'bad model!' })),
    );
    expect(badModel.status).toBe(400);
  });

  it('maps empty probe content to an invalid outcome with a format reason', async () => {
    const deps = dependencies({
      fetchProvider: vi.fn().mockResolvedValue(providerSuccess('')),
    });
    const response = await createAskGenerateHandler(deps)(request(testBody()));
    await expect(outcome(response)).resolves.toEqual({
      status: 'success',
      ok: false,
      reason: 'empty_response',
    });
  });

  it('maps upstream 401 to invalid_provider_key', async () => {
    const deps = dependencies({
      fetchProvider: vi.fn().mockResolvedValue(new Response('denied', { status: 401 })),
    });
    const response = await createAskGenerateHandler(deps)(request(testBody()));
    await expect(outcome(response)).resolves.toEqual({ status: 'invalid_provider_key' });
  });

  // ADR 0046：探针只回答「这条连接能不能用」。工具调用与长上下文不再分级，
  // 因为 Ask 已经没有第二条路径可降级，分级只会把可用的模型挡在门外。
  it('probes connectivity with a single upstream request and grades nothing', async () => {
    const deps = dependencies({
      fetchProvider: vi.fn().mockResolvedValue(providerSuccess('{"ok":true}')),
    });
    const response = await createAskGenerateHandler(deps)(request(testBody()));
    await expect(outcome(response)).resolves.toEqual({
      status: 'success',
      ok: true,
      reason: null,
    });
    expect((deps.fetchProvider as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });
});
