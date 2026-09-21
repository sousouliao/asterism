import {
  type AskSseErrorStatus,
  type AskSseEvent,
  type AskToolCall,
  createAskSseDecoder,
} from '@asterism/core';
import { FunctionsHttpError } from '@supabase/supabase-js';
import type { SupabaseClient } from './client';

export interface AskGenerateToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface AskGenerateMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: AskGenerateToolCall[];
}

export interface AskGenerateRequest {
  provider: string;
  model: string;
  /** 用户 BYOK 的 Provider key：仅随本次请求透传，由调用方从本地存储读取。 */
  providerKey: string;
  messages: AskGenerateMessage[];
  tools?: unknown[];
  toolChoice?: unknown;
}

export type AskGenerateOutcome =
  | { status: 'success'; content: string; toolCalls: AskToolCall[] }
  | { status: 'invalid_provider_key' }
  | { status: 'provider_rejected' }
  | { status: 'timeout' }
  | { status: 'retryable_error' };

export interface StreamAskGenerateOptions {
  onDelta: (text: string) => void;
  onToolCall?: (call: AskToolCall) => void;
  signal?: AbortSignal;
}

function isAskGenerateOutcome(value: unknown): value is AskGenerateOutcome {
  if (!value || typeof value !== 'object' || !('status' in value)) {
    return false;
  }
  const outcome = value as Record<string, unknown>;
  if (outcome.status === 'success') {
    return typeof outcome.content === 'string';
  }
  return ['invalid_provider_key', 'provider_rejected', 'timeout', 'retryable_error'].includes(
    String(outcome.status),
  );
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    const reason = signal.reason;
    throw reason instanceof Error ? reason : new DOMException('Aborted', 'AbortError');
  }
}

function applySseEvent(
  event: AskSseEvent,
  state: { content: string; toolCalls: AskToolCall[]; error: AskSseErrorStatus | null },
  onDelta: (text: string) => void,
  onToolCall?: (call: AskToolCall) => void,
): void {
  if (event.event === 'delta') {
    state.content += event.text;
    onDelta(event.text);
    return;
  }
  if (event.event === 'tool_call') {
    const call = { id: event.id, name: event.name, arguments: event.arguments };
    state.toolCalls.push(call);
    onToolCall?.(call);
    return;
  }
  if (event.event === 'error') {
    state.error = event.status;
  }
}

async function consumeAskSse(
  response: Response,
  onDelta: (text: string) => void,
  onToolCall?: (call: AskToolCall) => void,
  signal?: AbortSignal,
): Promise<AskGenerateOutcome> {
  const body = response.body;
  if (!body) {
    return { status: 'retryable_error' };
  }

  const decoder = createAskSseDecoder();
  const textDecoder = new TextDecoder();
  const reader = body.getReader();
  const state = {
    content: '',
    toolCalls: [] as AskToolCall[],
    error: null as AskSseErrorStatus | null,
  };

  try {
    while (true) {
      throwIfAborted(signal);
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      for (const event of decoder.push(textDecoder.decode(value, { stream: true }))) {
        applySseEvent(event, state, onDelta, onToolCall);
      }
    }
    for (const event of decoder.end()) {
      applySseEvent(event, state, onDelta, onToolCall);
    }
  } catch (error) {
    throwIfAborted(signal);
    if (isAbortError(error)) {
      throw error;
    }
    return { status: 'retryable_error' };
  } finally {
    reader.releaseLock();
  }

  if (state.error) {
    return { status: state.error };
  }
  if (state.content.length === 0 && state.toolCalls.length === 0) {
    return { status: 'retryable_error' };
  }
  return { status: 'success', content: state.content, toolCalls: state.toolCalls };
}

/**
 * 调用 `ask-generate` Edge Function 的生成动作（ADR 0042 / 0044）。
 * 优先消费 SSE；网关退化成 JSON 时按单块 delta 降级。
 * 会话过期、网络与网关故障统一折叠为可重试 / 超时两类。
 */
export async function streamAskGenerate(
  client: SupabaseClient,
  request: AskGenerateRequest,
  options: StreamAskGenerateOptions,
): Promise<AskGenerateOutcome> {
  throwIfAborted(options.signal);

  const { data, error } = await client.functions.invoke<unknown>('ask-generate', {
    body: {
      provider: request.provider,
      model: request.model,
      providerKey: request.providerKey,
      messages: request.messages,
      ...(request.tools ? { tools: request.tools } : {}),
      ...(request.toolChoice !== undefined ? { tool_choice: request.toolChoice } : {}),
    },
    signal: options.signal,
  });

  throwIfAborted(options.signal);

  if (error) {
    if (isAbortError(error)) {
      throw error;
    }
    if (error instanceof FunctionsHttpError && error.context?.status === 504) {
      return { status: 'timeout' };
    }
    return { status: 'retryable_error' };
  }

  if (data instanceof Response) {
    return consumeAskSse(data, options.onDelta, options.onToolCall, options.signal);
  }

  if (!isAskGenerateOutcome(data)) {
    return { status: 'retryable_error' };
  }
  if (data.status === 'success') {
    if (data.content.length > 0) {
      options.onDelta(data.content);
    }
    return { ...data, toolCalls: data.toolCalls ?? [] };
  }
  return data;
}

export interface AskModelsRequest {
  provider: string;
  /** 用户 BYOK 的 Provider key：仅随本次请求透传，由调用方从草稿或本地存储读取。 */
  providerKey: string;
}

export type AskModelsOutcome =
  | { status: 'success'; models: string[] }
  | { status: 'invalid_provider_key' }
  | { status: 'unavailable' };

export interface AskTestRequest extends AskModelsRequest {
  model: string;
}

/** 探针结论：`reason` 沿用旧探针词汇，供界面映射可读的失败原因。 */
export type AskTestOutcome =
  | { status: 'passed' }
  | { status: 'failed'; reason: 'unauthorized' | 'empty_response' | 'network' }
  | { status: 'unavailable' };

/**
 * 调用 `ask-generate` 的 test 动作（ADR 0043）：用给定 key + 模型发送一次最小生成
 * 请求，验证连接可用性。结果不落服务端，由调用方在本地连接记录上更新状态。
 */
export async function invokeAskTest(
  client: SupabaseClient,
  request: AskTestRequest,
): Promise<AskTestOutcome> {
  const { data, error } = await client.functions.invoke<unknown>('ask-generate', {
    body: {
      action: 'test',
      provider: request.provider,
      model: request.model,
      providerKey: request.providerKey,
    },
  });
  if (error || data === null || typeof data !== 'object') {
    return { status: 'unavailable' };
  }
  const outcome = data as Record<string, unknown>;
  if (outcome.status === 'invalid_provider_key') {
    return { status: 'failed', reason: 'unauthorized' };
  }
  if (outcome.status === 'success') {
    if (outcome.ok === true) {
      return { status: 'passed' };
    }
    if (outcome.reason === 'empty_response') {
      return { status: 'failed', reason: 'empty_response' };
    }
    return { status: 'failed', reason: 'network' };
  }
  return { status: 'unavailable' };
}

/**
 * 调用 `ask-generate` 的 models 动作（ADR 0043）：用草稿中的 key 检测该 Provider 的
 * 模型列表。除「key 被拒」可明确提示外，其余失败一律折叠为不可用，界面回退手填。
 */
export async function invokeAskModels(
  client: SupabaseClient,
  request: AskModelsRequest,
): Promise<AskModelsOutcome> {
  const { data, error } = await client.functions.invoke<unknown>('ask-generate', {
    body: {
      action: 'models',
      provider: request.provider,
      providerKey: request.providerKey,
    },
  });
  if (error || data === null || typeof data !== 'object') {
    return { status: 'unavailable' };
  }
  const outcome = data as Record<string, unknown>;
  if (outcome.status === 'success') {
    if (
      !Array.isArray(outcome.models) ||
      outcome.models.some((model) => typeof model !== 'string')
    ) {
      return { status: 'unavailable' };
    }
    return { status: 'success', models: outcome.models };
  }
  if (outcome.status === 'invalid_provider_key') {
    return { status: 'invalid_provider_key' };
  }
  return { status: 'unavailable' };
}
