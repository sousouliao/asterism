import { FunctionsHttpError } from '@supabase/supabase-js';
import type { SupabaseClient } from './client';

export interface AskGenerateMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AskGenerateRequest {
  provider: string;
  model: string;
  /** 用户 BYOK 的 Provider key：仅随本次请求透传，由调用方从本地存储读取。 */
  providerKey: string;
  messages: AskGenerateMessage[];
  responseFormat?: 'json_object';
}

export type AskGenerateOutcome =
  | { status: 'success'; content: string }
  | { status: 'invalid_provider_key' }
  | { status: 'provider_rejected' }
  | { status: 'timeout' }
  | { status: 'retryable_error' };

function isAskGenerateOutcome(value: unknown): value is AskGenerateOutcome {
  if (!value || typeof value !== 'object' || !('status' in value)) {
    return false;
  }
  const outcome = value as Record<string, unknown>;
  if (outcome.status === 'success') {
    return typeof outcome.content === 'string' && outcome.content.length > 0;
  }
  return ['invalid_provider_key', 'provider_rejected', 'timeout', 'retryable_error'].includes(
    String(outcome.status),
  );
}

/**
 * 调用 `ask-generate` Edge Function（ADR 0042 无状态 BYOK 代理）。
 * 会话过期、网络与网关故障统一折叠为可重试 / 超时两类，由界面给出重试路径。
 */
export async function invokeAskGenerate(
  client: SupabaseClient,
  request: AskGenerateRequest,
): Promise<AskGenerateOutcome> {
  const body: Record<string, unknown> = {
    provider: request.provider,
    model: request.model,
    providerKey: request.providerKey,
    messages: request.messages,
  };
  if (request.responseFormat) {
    body.responseFormat = request.responseFormat;
  }

  const { data, error } = await client.functions.invoke<unknown>('ask-generate', { body });
  if (error) {
    if (error instanceof FunctionsHttpError && error.context?.status === 504) {
      return { status: 'timeout' };
    }
    return { status: 'retryable_error' };
  }
  if (!isAskGenerateOutcome(data)) {
    return { status: 'retryable_error' };
  }
  if (data.status === 'provider_rejected') {
    return { status: 'provider_rejected' };
  }
  return data;
}
