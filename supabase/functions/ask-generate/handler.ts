const BASE_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * 本函数的请求体携带用户的 Provider key，因此允许部署方用 `ASK_ALLOWED_ORIGINS`
 * （逗号分隔）把跨源访问收敛到自己的应用域名。未配置时回落到 `*`，保持自部署
 * 开箱可用——同源策略已使第三方站点无法读取受害者 localStorage 中的 key，
 * 收紧 CORS 是纵深防御而非唯一屏障。
 */
function resolveCorsHeaders(
  request: Request,
  allowedOrigins: readonly string[] | undefined,
): Record<string, string> {
  const [fallback] = allowedOrigins ?? [];
  if (fallback === undefined) {
    return { ...BASE_CORS_HEADERS, 'Access-Control-Allow-Origin': '*' };
  }
  const origin = request.headers.get('Origin');
  const allowed = origin !== null && allowedOrigins?.includes(origin) === true;
  return {
    ...BASE_CORS_HEADERS,
    // 不匹配时回显首个允许来源：浏览器据此拒绝该响应，且不泄漏允许列表全貌。
    'Access-Control-Allow-Origin': allowed ? origin : fallback,
    Vary: 'Origin',
  };
}

/**
 * Provider 白名单（ADR 0042）直接取自 `packages/core` 的共享注册表，两侧不再各存
 * 一份副本；新增 Provider 只改注册表并走 ADR。该模块是零依赖叶子文件，可被 Deno
 * 直接加载（同 `bulk-organize` 引用 `database.types.ts` 的既有做法）。
 */
import {
  findAskProvider,
  isAllowedAskProvider,
} from '../../../packages/core/src/repos/ask-providers.ts';
import {
  type AskSseEvent,
  createOpenAiStreamDecoder,
  createOpenAiToolCallAssembler,
  encodeAskSseEvent,
} from '../../../packages/core/src/repos/ask-sse.ts';

/** 模型检测返回条数上限（ADR 0043）：OpenRouter 会返回数百条，封顶约束响应体大小。 */
const MAX_MODELS = 200;

/** 连接探针的固定最小请求（ADR 0043）：只验证 key + 模型能返回非空内容。 */
const PROBE_MESSAGES: ProviderMessage[] = [
  { role: 'system', content: 'Respond with the JSON object {"ok":true} and nothing else.' },
  { role: 'user', content: 'connection probe' },
];

const MAX_MESSAGES = 80;
const MAX_MESSAGE_CHARS = 250_000;
const MAX_TOTAL_CHARS = 600_000;
const MAX_TOOLS = 8;
const DEFAULT_TIMEOUT_MS = 60_000;
/** 流式生成：连续无 delta 才判失败，避免把正常的长回答掐断（ADR 0044）。 */
const DEFAULT_IDLE_TIMEOUT_MS = 30_000;

/**
 * 生成回答的 completion 上限。BYOK 花的是用户自己的额度，代理必须给出上限，
 * 否则任何持有效 JWT 的调用方都能用一次请求耗尽对方配额。Ask 的回答是
 * 摘要 + 至多 5 条推荐，4096 token 覆盖工具循环中的短思考与最终回答。
 */
const MAX_COMPLETION_TOKENS = 4096;

interface ProviderToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface ProviderMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: ProviderToolCall[];
}

export interface AskGenerateDependencies {
  authenticate: (jwt: string) => Promise<string | null>;
  fetchProvider: typeof fetch;
  /** 上游请求超时（毫秒）；测试注入小值。生成动作用于响应头，models/test 用于整段请求。 */
  timeoutMs?: number;
  /** 生成流空闲超时（毫秒）；测试注入小值。 */
  idleTimeoutMs?: number;
  /** 允许的浏览器来源；留空表示不限制（自部署默认）。 */
  allowedOrigins?: readonly string[];
}

interface ValidatedBody {
  provider: string;
  model: string;
  providerKey: string;
  messages: ProviderMessage[];
  temperature?: number;
  tools?: unknown[];
  toolChoice?: unknown;
}

interface ValidatedModelsBody {
  provider: string;
  providerKey: string;
}

interface ValidatedTestBody extends ValidatedModelsBody {
  model: string;
}

function createJsonResponder(cors: Record<string, string>) {
  return (body: Record<string, unknown>, status = 200): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
}

/** 上游 base URL；调用点已通过 `isAllowedAskProvider` 校验，故必定命中。 */
function providerBaseUrl(provider: string): string {
  const definition = findAskProvider(provider);
  if (!definition) {
    throw new Error(`Unlisted provider reached dispatch: ${provider}`);
  }
  return definition.baseUrl;
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
  if (typeof provider !== 'string' || !isAllowedAskProvider(provider)) {
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
    const record = entry as Record<string, unknown>;
    const { role, content } = record;
    if (role !== 'system' && role !== 'user' && role !== 'assistant' && role !== 'tool') {
      return null;
    }
    if (typeof content !== 'string' || content.length > MAX_MESSAGE_CHARS) {
      return null;
    }
    if (role !== 'assistant' && content.length === 0) {
      return null;
    }
    totalChars += content.length;
    if (totalChars > MAX_TOTAL_CHARS) {
      return null;
    }
    const message: ProviderMessage = { role, content };
    if (role === 'tool') {
      if (typeof record.tool_call_id !== 'string' || record.tool_call_id.length === 0) {
        return null;
      }
      message.tool_call_id = record.tool_call_id;
    }
    if (role === 'assistant' && record.tool_calls !== undefined) {
      const toolCalls = parseToolCalls(record.tool_calls);
      if (!toolCalls) {
        return null;
      }
      message.tool_calls = toolCalls;
    }
    messages.push(message);
  }

  let temperature: number | undefined;
  if (body.temperature !== undefined) {
    if (typeof body.temperature !== 'number' || body.temperature < 0 || body.temperature > 2) {
      return null;
    }
    temperature = body.temperature;
  }

  let tools: unknown[] | undefined;
  if (body.tools !== undefined) {
    if (!Array.isArray(body.tools) || body.tools.length === 0 || body.tools.length > MAX_TOOLS) {
      return null;
    }
    tools = body.tools;
  }

  return {
    provider,
    model: body.model,
    providerKey: body.providerKey,
    messages,
    temperature,
    tools,
    toolChoice: body.tool_choice,
  };
}

function parseToolCalls(raw: unknown): ProviderToolCall[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_TOOLS) {
    return null;
  }
  const calls: ProviderToolCall[] = [];
  for (const entry of raw) {
    if (entry === null || typeof entry !== 'object') {
      return null;
    }
    const record = entry as Record<string, unknown>;
    const fn = record.function;
    if (
      typeof record.id !== 'string' ||
      record.id.length === 0 ||
      record.type !== 'function' ||
      fn === null ||
      typeof fn !== 'object'
    ) {
      return null;
    }
    const name = (fn as Record<string, unknown>).name;
    const args = (fn as Record<string, unknown>).arguments;
    if (typeof name !== 'string' || name.length === 0 || typeof args !== 'string') {
      return null;
    }
    calls.push({ id: record.id, type: 'function', function: { name, arguments: args } });
  }
  return calls;
}

function createSseResponder(cors: Record<string, string>) {
  return (body: BodyInit): Response =>
    new Response(body, {
      status: 200,
      headers: {
        ...cors,
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
}

function createHeaderTimeout(ms: number): { signal: AbortSignal; dispose: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new DOMException('timed out', 'TimeoutError'));
  }, ms);
  return {
    signal: controller.signal,
    dispose: () => clearTimeout(timer),
  };
}

function transformOpenAiStream(idleTimeoutMs: number): TransformStream<Uint8Array, Uint8Array> {
  const decoder = createOpenAiStreamDecoder();
  const assembler = createOpenAiToolCallAssembler();
  const textDecoder = new TextDecoder();
  const textEncoder = new TextEncoder();
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let finished = false;
  let emitted = false;

  const enqueue = (
    controller: TransformStreamDefaultController<Uint8Array>,
    event: AskSseEvent,
  ) => {
    controller.enqueue(textEncoder.encode(encodeAskSseEvent(event)));
  };

  const emitParts = (
    controller: TransformStreamDefaultController<Uint8Array>,
    parts: ReturnType<ReturnType<typeof createOpenAiStreamDecoder>['push']>,
  ) => {
    let active = false;
    for (const part of parts) {
      assembler.push(part);
      if (part.kind === 'text') {
        emitted = true;
        active = true;
        enqueue(controller, { event: 'delta', text: part.text });
      } else if (part.kind === 'tool_delta') {
        active = true;
      }
    }
    return active;
  };

  const flushToolCalls = (controller: TransformStreamDefaultController<Uint8Array>) => {
    for (const call of assembler.finish()) {
      emitted = true;
      enqueue(controller, {
        event: 'tool_call',
        id: call.id,
        name: call.name,
        arguments: call.arguments,
      });
    }
  };

  const clearIdle = () => {
    if (idleTimer !== null) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  };

  const armIdle = (controller: TransformStreamDefaultController<Uint8Array>) => {
    clearIdle();
    idleTimer = setTimeout(() => {
      if (finished) {
        return;
      }
      finished = true;
      enqueue(controller, { event: 'error', status: 'timeout' });
      enqueue(controller, { event: 'done' });
      try {
        controller.terminate();
      } catch {
        // 流已关闭
      }
    }, idleTimeoutMs);
  };

  return new TransformStream<Uint8Array, Uint8Array>({
    start(controller) {
      armIdle(controller);
    },
    transform(chunk, controller) {
      if (finished) {
        return;
      }
      const parts = decoder.push(textDecoder.decode(chunk, { stream: true }));
      if (emitParts(controller, parts)) {
        armIdle(controller);
      }
    },
    flush(controller) {
      clearIdle();
      if (finished) {
        return;
      }
      finished = true;
      emitParts(controller, decoder.end());
      flushToolCalls(controller);
      if (!emitted) {
        enqueue(controller, { event: 'error', status: 'retryable_error' });
      }
      enqueue(controller, { event: 'done' });
    },
  });
}

/** 模型检测动作只携带 Provider 与 key（ADR 0043）；白名单与 key 规则与生成一致。 */
function validateModelsBody(raw: unknown): ValidatedModelsBody | null {
  if (raw === null || typeof raw !== 'object') {
    return null;
  }
  const body = raw as Record<string, unknown>;
  if (typeof body.provider !== 'string' || !isAllowedAskProvider(body.provider)) {
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

const PING_TOOL = {
  type: 'function',
  function: {
    name: 'ping',
    description: 'Acknowledge the capability probe.',
    parameters: {
      type: 'object',
      properties: { ok: { type: 'boolean' } },
      required: ['ok'],
    },
  },
};

const EXPAND_TOOL = {
  type: 'function',
  function: {
    name: 'expand',
    description: 'Read a repository by id.',
    parameters: {
      type: 'object',
      properties: { ids: { type: 'array', items: { type: 'string' } } },
      required: ['ids'],
    },
  },
};

function extractToolCalls(payload: unknown): { name: string; arguments: string }[] {
  const choices = (payload as { choices?: { message?: { tool_calls?: unknown } }[] } | null)
    ?.choices;
  const raw = choices?.[0]?.message?.tool_calls;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.flatMap((entry) => {
    if (entry === null || typeof entry !== 'object') {
      return [];
    }
    const fn = (entry as { function?: { name?: unknown; arguments?: unknown } }).function;
    if (typeof fn?.name !== 'string' || typeof fn.arguments !== 'string') {
      return [];
    }
    return [{ name: fn.name, arguments: fn.arguments }];
  });
}

async function fetchJsonCompletion(
  dependencies: AskGenerateDependencies,
  input: ValidatedTestBody,
  body: Record<string, unknown>,
): Promise<unknown | null> {
  try {
    const response = await dependencies.fetchProvider(
      `${providerBaseUrl(input.provider)}/chat/completions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${input.providerKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        redirect: 'manual',
        signal: AbortSignal.timeout(dependencies.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      },
    );
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  }
}

function hasNamedToolCall(
  payload: unknown,
  name: string,
  predicate: (args: Record<string, unknown>) => boolean,
): boolean {
  for (const call of extractToolCalls(payload)) {
    if (call.name !== name) {
      continue;
    }
    try {
      const parsed = JSON.parse(call.arguments) as unknown;
      if (
        parsed !== null &&
        typeof parsed === 'object' &&
        predicate(parsed as Record<string, unknown>)
      ) {
        return true;
      }
    } catch {
      // 忽略无法解析的 arguments
    }
  }
  return false;
}

async function probeGenerationCapability(
  dependencies: AskGenerateDependencies,
  input: ValidatedTestBody,
): Promise<{ tools: boolean; longContext: boolean }> {
  const toolsPayload = await fetchJsonCompletion(dependencies, input, {
    model: input.model,
    messages: [
      { role: 'system', content: 'Call the ping tool. Do not write prose.' },
      { role: 'user', content: 'Call ping with ok=true.' },
    ],
    tools: [PING_TOOL],
    tool_choice: { type: 'function', function: { name: 'ping' } },
    temperature: 0,
    max_tokens: 128,
  });
  const tools = hasNamedToolCall(toolsPayload, 'ping', (args) => args.ok === true);

  const catalog = [
    ...Array.from({ length: 12 }, (_, index) => `r_${index} | owner/repo-${index} | Go | web`),
    'needle-unique-asterism | owner/needle-unique-asterism | Rust | probe',
    ...Array.from(
      { length: 11 },
      (_, index) => `r_${index + 13} | owner/repo-${index + 13} | Go | web`,
    ),
  ].join('\n');
  const longPayload = await fetchJsonCompletion(dependencies, input, {
    model: input.model,
    messages: [
      {
        role: 'system',
        content: `Catalog:\n${catalog}\nCall expand with the repoId of owner/needle-unique-asterism.`,
      },
      { role: 'user', content: 'Locate the needle repository and expand it.' },
    ],
    tools: [EXPAND_TOOL],
    tool_choice: { type: 'function', function: { name: 'expand' } },
    temperature: 0,
    max_tokens: 128,
  });
  const longContext = hasNamedToolCall(longPayload, 'expand', (args) => {
    const ids = args.ids;
    return Array.isArray(ids) && ids.includes('needle-unique-asterism');
  });

  return { tools, longContext };
}

export function createAskGenerateHandler(dependencies: AskGenerateDependencies) {
  return async (request: Request): Promise<Response> => {
    const corsHeaders = resolveCorsHeaders(request, dependencies.allowedOrigins);
    const json = createJsonResponder(corsHeaders);
    const sse = createSseResponder(corsHeaders);

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
          `${providerBaseUrl(modelsBody.provider)}/models`,
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${modelsBody.providerKey}` },
            redirect: 'manual',
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
      if (findAskProvider(testBody.provider)?.supportsJsonMode) {
        probeBody.response_format = { type: 'json_object' };
      }
      let probeResponse: Response;
      try {
        probeResponse = await dependencies.fetchProvider(
          `${providerBaseUrl(testBody.provider)}/chat/completions`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${testBody.providerKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(probeBody),
            redirect: 'manual',
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
      } catch {
        return json({ status: 'retryable_error' }, 502);
      }

      const capability = await probeGenerationCapability(dependencies, testBody);
      return json({
        status: 'success',
        ok: true,
        reason: null,
        tools: capability.tools,
        longContext: capability.longContext,
        mode: capability.tools && capability.longContext ? 'agent' : 'fixed',
      });
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
      max_tokens: MAX_COMPLETION_TOKENS,
      stream: true,
    };
    if (body.temperature !== undefined) {
      upstreamBody.temperature = body.temperature;
    }
    if (body.tools) {
      upstreamBody.tools = body.tools;
    }
    if (body.toolChoice !== undefined) {
      upstreamBody.tool_choice = body.toolChoice;
    }

    const headerTimeout = createHeaderTimeout(dependencies.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    let response: Response;
    try {
      response = await dependencies.fetchProvider(
        `${providerBaseUrl(body.provider)}/chat/completions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${body.providerKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(upstreamBody),
          // 白名单只约束首跳；跟随重定向会让被劫持或被滥用的上游把请求
          // （连同 Authorization 头）带到白名单外的主机。
          redirect: 'manual',
          signal: headerTimeout.signal,
        },
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        return json({ error: 'Upstream request timed out' }, 504);
      }
      return json({ status: 'retryable_error' }, 502);
    } finally {
      headerTimeout.dispose();
    }

    if (response.status === 401 || response.status === 403) {
      return json({ status: 'invalid_provider_key' });
    }
    if (!response.ok) {
      return json({ status: 'provider_rejected', upstreamStatus: response.status });
    }

    const contentType = response.headers.get('Content-Type') ?? '';
    if (!contentType.toLowerCase().includes('text/event-stream')) {
      try {
        const payload = (await response.json()) as {
          choices?: {
            message?: {
              content?: unknown;
              tool_calls?: {
                id?: unknown;
                function?: { name?: unknown; arguments?: unknown };
              }[];
            };
          }[];
        };
        const message = payload.choices?.[0]?.message;
        const content = typeof message?.content === 'string' ? message.content : '';
        const toolCalls = (message?.tool_calls ?? []).flatMap((call) => {
          if (
            typeof call.id === 'string' &&
            typeof call.function?.name === 'string' &&
            typeof call.function.arguments === 'string'
          ) {
            return [
              encodeAskSseEvent({
                event: 'tool_call',
                id: call.id,
                name: call.function.name,
                arguments: call.function.arguments,
              }),
            ];
          }
          return [];
        });
        if (content.length === 0 && toolCalls.length === 0) {
          return json({ status: 'retryable_error' }, 502);
        }
        return sse(
          (content.length > 0 ? encodeAskSseEvent({ event: 'delta', text: content }) : '') +
            toolCalls.join('') +
            encodeAskSseEvent({ event: 'done' }),
        );
      } catch {
        return json({ status: 'retryable_error' }, 502);
      }
    }

    if (!response.body) {
      return json({ status: 'retryable_error' }, 502);
    }

    return sse(
      response.body.pipeThrough(
        transformOpenAiStream(dependencies.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS),
      ),
    );
  };
}
