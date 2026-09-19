const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Provider 白名单（ADR 0042）。Edge Function 按仓库约定自包含，与 `packages/core`
 * 的 `ASK_PROVIDERS` 维护同一映射；新增 Provider 必须两侧同步并走 ADR。
 */
const PROVIDER_BASE_URLS: Record<string, string> = {
  deepseek: 'https://api.deepseek.com',
  openai: 'https://api.openai.com/v1',
  groq: 'https://api.groq.com/openai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
};

/** 探针与生成是否启用 `response_format: json_object`；与 core `supportsJsonMode` 同步。 */
const PROVIDER_JSON_MODE: Record<string, boolean> = {
  deepseek: true,
  openai: true,
  groq: true,
  openrouter: false,
};

/** 模型检测返回条数上限（ADR 0043）：OpenRouter 会返回数百条，封顶约束响应体大小。 */
const MAX_MODELS = 200;

/** 连接探针的固定最小请求（ADR 0043）：只验证 key + 模型能返回非空内容。 */
const PROBE_MESSAGES: ProviderMessage[] = [
  { role: 'system', content: 'Respond with the JSON object {"ok":true} and nothing else.' },
  { role: 'user', content: 'connection probe' },
];

const MAX_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 32_000;
const MAX_TOTAL_CHARS = 200_000;
const DEFAULT_TIMEOUT_MS = 60_000;

interface ProviderMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AskGenerateDependencies {
  authenticate: (jwt: string) => Promise<string | null>;
  fetchProvider: typeof fetch;
  /** 上游请求超时（毫秒）；测试注入小值。 */
  timeoutMs?: number;
}

interface ValidatedBody {
  provider: string;
  model: string;
  providerKey: string;
  messages: ProviderMessage[];
  temperature?: number;
  responseFormat?: 'json_object';
}

interface ValidatedModelsBody {
  provider: string;
  providerKey: string;
}

interface ValidatedTestBody extends ValidatedModelsBody {
  model: string;
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isModelId(value: unknown): value is string {
  return typeof value === 'string' && /^[\w./:-]{1,100}$/.test(value);
}

function isProviderKey(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 8 && value.length <= 4096;
}

/**
 * 校验并收敛请求体。prompt 由客户端用 `@asterism/core` 组装；本函数只接受
 * 已限定的字段，任何多余或越界输入直接拒绝，不做静默修剪。
 */
function validateBody(raw: unknown): ValidatedBody | null {
  if (raw === null || typeof raw !== 'object') {
    return null;
  }
  const body = raw as Record<string, unknown>;
  const provider = body.provider;
  if (typeof provider !== 'string' || !(provider in PROVIDER_BASE_URLS)) {
    return null;
  }
  if (!isModelId(body.model) || !isProviderKey(body.providerKey)) {
    return null;
  }

  const rawMessages = body.messages;
  if (
    !Array.isArray(rawMessages) ||
    rawMessages.length === 0 ||
    rawMessages.length > MAX_MESSAGES
  ) {
    return null;
  }
  let totalChars = 0;
  const messages: ProviderMessage[] = [];
  for (const entry of rawMessages) {
    if (entry === null || typeof entry !== 'object') {
      return null;
    }
    const { role, content } = entry as Record<string, unknown>;
    if (role !== 'system' && role !== 'user' && role !== 'assistant') {
      return null;
    }
    if (typeof content !== 'string' || content.length === 0 || content.length > MAX_MESSAGE_CHARS) {
      return null;
    }
    totalChars += content.length;
    if (totalChars > MAX_TOTAL_CHARS) {
      return null;
    }
    messages.push({ role, content });
  }

  let temperature: number | undefined;
  if (body.temperature !== undefined) {
    if (typeof body.temperature !== 'number' || body.temperature < 0 || body.temperature > 2) {
      return null;
    }
    temperature = body.temperature;
  }

  let responseFormat: 'json_object' | undefined;
  if (body.responseFormat !== undefined) {
    if (body.responseFormat !== 'json_object') {
      return null;
    }
    responseFormat = 'json_object';
  }

  return {
    provider,
    model: body.model,
    providerKey: body.providerKey,
    messages,
    temperature,
    responseFormat,
  };
}

/** 模型检测动作只携带 Provider 与 key（ADR 0043）；白名单与 key 规则与生成一致。 */
function validateModelsBody(raw: unknown): ValidatedModelsBody | null {
  if (raw === null || typeof raw !== 'object') {
    return null;
  }
  const body = raw as Record<string, unknown>;
  if (typeof body.provider !== 'string' || !(body.provider in PROVIDER_BASE_URLS)) {
    return null;
  }
  if (!isProviderKey(body.providerKey)) {
    return null;
  }
  return { provider: body.provider, providerKey: body.providerKey };
}

/** 探针动作在凭据之上再要求一个合法模型 ID（ADR 0043）。 */
function validateTestBody(raw: unknown): ValidatedTestBody | null {
  const credentials = validateModelsBody(raw);
  if (!credentials) {
    return null;
  }
  const model = (raw as Record<string, unknown>).model;
  if (!isModelId(model)) {
    return null;
  }
  return { ...credentials, model };
}

/**
 * 解析 OpenAI 兼容 `GET /models` 响应（`data[].id`）：trim、去重、按字典序排序并封顶。
 * 上游 200 但无可解析条目时返回空列表，由客户端按「检测不可用」处理。
 */
function parseModelList(payload: unknown): string[] {
  const data = (payload as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) {
    return [];
  }
  const ids = new Set<string>();
  for (const entry of data) {
    const id = (entry as { id?: unknown } | null)?.id;
    if (typeof id === 'string' && id.trim().length > 0) {
      ids.add(id.trim());
    }
  }
  return [...ids].sort((a, b) => a.localeCompare(b)).slice(0, MAX_MODELS);
}

export function createAskGenerateHandler(dependencies: AskGenerateDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    const jwt = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    if (!jwt) {
      return json({ error: 'Missing Authorization bearer token' }, 401);
    }

    let userId: string | null;
    try {
      userId = await dependencies.authenticate(jwt);
    } catch {
      userId = null;
    }
    if (!userId) {
      return json({ error: 'Invalid or expired session' }, 401);
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }
    const action = (rawBody as Record<string, unknown> | null)?.action;

    // 模型检测（ADR 0043）：同一白名单、同一 key 透传规则的 GET /models 转发。
    if (action === 'models') {
      const modelsBody = validateModelsBody(rawBody);
      if (!modelsBody) {
        return json({ error: 'Invalid ask-generate request' }, 400);
      }
      let modelsResponse: Response;
      try {
        modelsResponse = await dependencies.fetchProvider(
          `${PROVIDER_BASE_URLS[modelsBody.provider]}/models`,
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${modelsBody.providerKey}` },
            signal: AbortSignal.timeout(dependencies.timeoutMs ?? DEFAULT_TIMEOUT_MS),
          },
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === 'TimeoutError') {
          return json({ error: 'Upstream request timed out' }, 504);
        }
        return json({ status: 'retryable_error' }, 502);
      }
      if (modelsResponse.status === 401 || modelsResponse.status === 403) {
        return json({ status: 'invalid_provider_key' });
      }
      if (!modelsResponse.ok) {
        return json({ status: 'retryable_error' }, 502);
      }
      try {
        return json({ status: 'success', models: parseModelList(await modelsResponse.json()) });
      } catch {
        return json({ status: 'retryable_error' }, 502);
      }
    }

    // 连接探针（ADR 0043）：验证 key + 模型可用的最小生成请求，reason 与旧探针词汇对齐。
    if (action === 'test') {
      const testBody = validateTestBody(rawBody);
      if (!testBody) {
        return json({ error: 'Invalid ask-generate request' }, 400);
      }
      const probeBody: Record<string, unknown> = {
        model: testBody.model,
        messages: PROBE_MESSAGES,
        temperature: 0,
        max_tokens: 512,
      };
      if (PROVIDER_JSON_MODE[testBody.provider]) {
        probeBody.response_format = { type: 'json_object' };
      }
      let probeResponse: Response;
      try {
        probeResponse = await dependencies.fetchProvider(
          `${PROVIDER_BASE_URLS[testBody.provider]}/chat/completions`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${testBody.providerKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(probeBody),
            signal: AbortSignal.timeout(dependencies.timeoutMs ?? DEFAULT_TIMEOUT_MS),
          },
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === 'TimeoutError') {
          return json({ error: 'Upstream request timed out' }, 504);
        }
        return json({ status: 'retryable_error' }, 502);
      }
      if (probeResponse.status === 401 || probeResponse.status === 403) {
        return json({ status: 'invalid_provider_key' });
      }
      if (!probeResponse.ok) {
        return json({ status: 'retryable_error' }, 502);
      }
      try {
        const payload = (await probeResponse.json()) as {
          choices?: { message?: { content?: unknown } }[];
        };
        const content = payload.choices?.[0]?.message?.content;
        if (typeof content !== 'string' || content.length === 0) {
          return json({ status: 'success', ok: false, reason: 'empty_response' });
        }
        return json({ status: 'success', ok: true, reason: null });
      } catch {
        return json({ status: 'retryable_error' }, 502);
      }
    }
    if (action !== undefined) {
      return json({ error: 'Invalid ask-generate request' }, 400);
    }

    const body = validateBody(rawBody);
    if (!body) {
      return json({ error: 'Invalid ask-generate request' }, 400);
    }

    // 无状态转发：Provider key 只随本次上游请求透传，不落日志、不落存储（ADR 0042）。
    const upstreamBody: Record<string, unknown> = {
      model: body.model,
      messages: body.messages,
    };
    if (body.temperature !== undefined) {
      upstreamBody.temperature = body.temperature;
    }
    if (body.responseFormat) {
      upstreamBody.response_format = { type: body.responseFormat };
    }

    let response: Response;
    try {
      response = await dependencies.fetchProvider(
        `${PROVIDER_BASE_URLS[body.provider]}/chat/completions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${body.providerKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(upstreamBody),
          signal: AbortSignal.timeout(dependencies.timeoutMs ?? DEFAULT_TIMEOUT_MS),
        },
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        return json({ error: 'Upstream request timed out' }, 504);
      }
      return json({ status: 'retryable_error' }, 502);
    }

    if (response.status === 401 || response.status === 403) {
      return json({ status: 'invalid_provider_key' });
    }
    if (!response.ok) {
      return json({ status: 'provider_rejected', upstreamStatus: response.status });
    }

    try {
      const payload = (await response.json()) as {
        choices?: { message?: { content?: unknown } }[];
      };
      const content = payload.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || content.length === 0) {
        return json({ status: 'retryable_error' }, 502);
      }
      return json({ status: 'success', content });
    } catch {
      return json({ status: 'retryable_error' }, 502);
    }
  };
}
