/**
 * Ask Asterism 的 Provider 白名单（ADR 0042）——**单一真相源**。
 *
 * 本文件刻意不引入任何依赖，因此既能被 `@asterism/core` 正常打包，也能被
 * `supabase/functions/ask-generate` 以相对路径直接 import。两处曾各自维护一份
 * 副本，新增 Provider 时容易只改一侧，导致客户端认为合法而服务端 400（或反之）。
 */

export type AskProviderId = 'deepseek' | 'openai' | 'groq' | 'openrouter';

export interface AskProviderDefinition {
  id: AskProviderId;
  /** OpenAI 兼容 chat completions 的固定上游 base URL。 */
  baseUrl: string;
  defaultModel: string;
  /** 是否随请求启用 `response_format: json_object`（OpenRouter 依上游模型而定，默认不启用）。 */
  supportsJsonMode: boolean;
  /** 界面 Provider 名称的 i18n key。 */
  labelKey: string;
}

export const ASK_PROVIDERS: readonly AskProviderDefinition[] = [
  {
    id: 'deepseek',
    baseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    supportsJsonMode: true,
    labelKey: 'ask.provider.deepseek',
  },
  {
    id: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    supportsJsonMode: true,
    labelKey: 'ask.provider.openai',
  },
  {
    id: 'groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    supportsJsonMode: true,
    labelKey: 'ask.provider.groq',
  },
  {
    id: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openrouter/auto',
    supportsJsonMode: false,
    labelKey: 'ask.provider.openrouter',
  },
];

export function findAskProvider(id: string): AskProviderDefinition | undefined {
  return ASK_PROVIDERS.find((provider) => provider.id === id);
}

/**
 * 白名单校验。必须基于显式查找而不是 `key in object`：后者会走原型链，
 * `constructor` / `toString` 之类的键会被误判为合法 Provider。
 */
export function isAllowedAskProvider(id: string): id is AskProviderId {
  return findAskProvider(id) !== undefined;
}
