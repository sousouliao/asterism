/**
 * Ask 的 SSE 编解码：零依赖叶子文件，供 Edge Function 与 `@asterism/db` 共用。
 *
 * Asterism 协议（生成动作下发，不是上游透传）：
 *   event: delta      → {"text":"..."}
 *   event: tool_call  → {"id":"...","name":"...","arguments":"..."}
 *   event: error      → {"status":"timeout"|"retryable_error"|...}
 *   event: done       → {}
 */

export const ASK_SSE_ERROR_STATUSES = [
  'invalid_provider_key',
  'provider_rejected',
  'timeout',
  'retryable_error',
] as const;

export type AskSseErrorStatus = (typeof ASK_SSE_ERROR_STATUSES)[number];

export interface AskToolCall {
  id: string;
  name: string;
  arguments: string;
}

export type AskSseEvent =
  | { event: 'delta'; text: string }
  | { event: 'tool_call'; id: string; name: string; arguments: string }
  | { event: 'error'; status: AskSseErrorStatus }
  | { event: 'done' };

export type OpenAiStreamPart =
  | { kind: 'text'; text: string }
  | { kind: 'tool_delta'; index: number; id?: string; name?: string; argumentsDelta?: string }
  | { kind: 'finish'; reason: string | null };

function isAskSseErrorStatus(value: unknown): value is AskSseErrorStatus {
  return typeof value === 'string' && (ASK_SSE_ERROR_STATUSES as readonly string[]).includes(value);
}

function normalizeNewlines(value: string): string {
  return value.replace(/\r\n/gu, '\n').replace(/\r/gu, '\n');
}

function splitCompleteBlocks(buffer: string): { blocks: string[]; rest: string } {
  const blocks: string[] = [];
  let rest = buffer;
  while (true) {
    const separator = rest.indexOf('\n\n');
    if (separator === -1) {
      return { blocks, rest };
    }
    blocks.push(rest.slice(0, separator));
    rest = rest.slice(separator + 2);
  }
}

function dataPayload(block: string): string | null {
  const lines: string[] = [];
  for (const rawLine of block.split('\n')) {
    if (rawLine.startsWith('data:')) {
      lines.push(rawLine.slice(5).trimStart());
    }
  }
  return lines.length > 0 ? lines.join('\n') : null;
}

function eventName(block: string): string | null {
  for (const rawLine of block.split('\n')) {
    if (rawLine.startsWith('event:')) {
      const name = rawLine.slice(6).trim();
      return name.length > 0 ? name : null;
    }
  }
  return null;
}

export function encodeAskSseEvent(event: AskSseEvent): string {
  if (event.event === 'delta') {
    return `event: delta\ndata: ${JSON.stringify({ text: event.text })}\n\n`;
  }
  if (event.event === 'tool_call') {
    return `event: tool_call\ndata: ${JSON.stringify({
      id: event.id,
      name: event.name,
      arguments: event.arguments,
    })}\n\n`;
  }
  if (event.event === 'error') {
    return `event: error\ndata: ${JSON.stringify({ status: event.status })}\n\n`;
  }
  return 'event: done\ndata: {}\n\n';
}

function parseAskSseBlock(block: string): AskSseEvent | null {
  const name = eventName(block);
  const payload = dataPayload(block);
  if (name === 'delta') {
    if (payload === null) {
      return null;
    }
    try {
      const parsed = JSON.parse(payload) as { text?: unknown };
      return typeof parsed.text === 'string' && parsed.text.length > 0
        ? { event: 'delta', text: parsed.text }
        : null;
    } catch {
      return null;
    }
  }
  if (name === 'tool_call') {
    if (payload === null) {
      return null;
    }
    try {
      const parsed = JSON.parse(payload) as {
        id?: unknown;
        name?: unknown;
        arguments?: unknown;
      };
      if (
        typeof parsed.id === 'string' &&
        parsed.id.length > 0 &&
        typeof parsed.name === 'string' &&
        parsed.name.length > 0 &&
        typeof parsed.arguments === 'string'
      ) {
        return {
          event: 'tool_call',
          id: parsed.id,
          name: parsed.name,
          arguments: parsed.arguments,
        };
      }
      return null;
    } catch {
      return null;
    }
  }
  if (name === 'error') {
    if (payload === null) {
      return { event: 'error', status: 'retryable_error' };
    }
    try {
      const parsed = JSON.parse(payload) as { status?: unknown };
      return {
        event: 'error',
        status: isAskSseErrorStatus(parsed.status) ? parsed.status : 'retryable_error',
      };
    } catch {
      return { event: 'error', status: 'retryable_error' };
    }
  }
  if (name === 'done') {
    return { event: 'done' };
  }
  return null;
}

/**
 * 增量解码 Asterism SSE。跨 chunk 截断的 `data:` 行会留在内部缓冲。
 */
export function createAskSseDecoder(): {
  push: (chunk: string) => AskSseEvent[];
  end: () => AskSseEvent[];
} {
  let buffer = '';
  const take = (source: string, flush: boolean): AskSseEvent[] => {
    const { blocks, rest } = splitCompleteBlocks(source);
    buffer = rest;
    const events: AskSseEvent[] = [];
    for (const block of blocks) {
      const event = parseAskSseBlock(block);
      if (event) {
        events.push(event);
      }
    }
    if (flush && buffer.trim().length > 0) {
      const event = parseAskSseBlock(buffer);
      buffer = '';
      if (event) {
        events.push(event);
      }
    }
    return events;
  };

  return {
    push(chunk: string): AskSseEvent[] {
      return take(buffer + normalizeNewlines(chunk), false);
    },
    end(): AskSseEvent[] {
      return take(buffer, true);
    },
  };
}

function extractOpenAiParts(block: string): OpenAiStreamPart[] {
  const payload = dataPayload(block);
  if (payload === null || payload === '[DONE]') {
    return [];
  }
  try {
    const parsed = JSON.parse(payload) as {
      choices?: {
        delta?: {
          content?: unknown;
          tool_calls?: {
            index?: unknown;
            id?: unknown;
            function?: { name?: unknown; arguments?: unknown };
          }[];
        };
        finish_reason?: unknown;
      }[];
    };
    const choice = parsed.choices?.[0];
    if (!choice) {
      return [];
    }
    const parts: OpenAiStreamPart[] = [];
    const content = choice.delta?.content;
    if (typeof content === 'string' && content.length > 0) {
      parts.push({ kind: 'text', text: content });
    }
    for (const call of choice.delta?.tool_calls ?? []) {
      const index = typeof call.index === 'number' ? call.index : 0;
      const id = typeof call.id === 'string' && call.id.length > 0 ? call.id : undefined;
      const name =
        typeof call.function?.name === 'string' && call.function.name.length > 0
          ? call.function.name
          : undefined;
      const argumentsDelta =
        typeof call.function?.arguments === 'string' && call.function.arguments.length > 0
          ? call.function.arguments
          : undefined;
      parts.push({ kind: 'tool_delta', index, id, name, argumentsDelta });
    }
    if (typeof choice.finish_reason === 'string') {
      parts.push({ kind: 'finish', reason: choice.finish_reason });
    }
    return parts;
  } catch {
    return [];
  }
}

/**
 * 增量解码 OpenAI 兼容 `chat.completions` SSE：文本 delta、分片 tool_calls、finish。
 */
export function createOpenAiStreamDecoder(): {
  push: (chunk: string) => OpenAiStreamPart[];
  end: () => OpenAiStreamPart[];
} {
  let buffer = '';
  const take = (source: string, flush: boolean): OpenAiStreamPart[] => {
    const { blocks, rest } = splitCompleteBlocks(source);
    buffer = rest;
    const parts: OpenAiStreamPart[] = [];
    for (const block of blocks) {
      parts.push(...extractOpenAiParts(block));
    }
    if (flush && buffer.trim().length > 0) {
      parts.push(...extractOpenAiParts(buffer));
      buffer = '';
    }
    return parts;
  };

  return {
    push(chunk: string): OpenAiStreamPart[] {
      return take(buffer + normalizeNewlines(chunk), false);
    },
    end(): OpenAiStreamPart[] {
      return take(buffer, true);
    },
  };
}

/** 把分片的 tool_calls delta 拼成完整调用。 */
export function createOpenAiToolCallAssembler(): {
  push: (part: OpenAiStreamPart) => void;
  finish: () => AskToolCall[];
} {
  const calls = new Map<number, { id: string; name: string; arguments: string }>();
  return {
    push(part: OpenAiStreamPart) {
      if (part.kind !== 'tool_delta') {
        return;
      }
      const current = calls.get(part.index) ?? { id: '', name: '', arguments: '' };
      if (part.id) {
        current.id = part.id;
      }
      if (part.name) {
        current.name = part.name;
      }
      if (part.argumentsDelta) {
        current.arguments += part.argumentsDelta;
      }
      calls.set(part.index, current);
    },
    finish(): AskToolCall[] {
      return [...calls.entries()]
        .toSorted((left, right) => left[0] - right[0])
        .map(([, value], index) => ({
          id: value.id || `call_${index}`,
          name: value.name,
          arguments: value.arguments,
        }))
        .filter((call) => call.name.length > 0);
    },
  };
}

/**
 * 增量解码 OpenAI 兼容 `chat.completions` SSE，吐出文本 delta。
 * 保留给不关心 tool_calls 的调用方。
 */
export function createOpenAiDeltaDecoder(): {
  push: (chunk: string) => string[];
  end: () => string[];
} {
  const decoder = createOpenAiStreamDecoder();
  const texts = (parts: OpenAiStreamPart[]): string[] =>
    parts.flatMap((part) => (part.kind === 'text' ? [part.text] : []));
  return {
    push(chunk: string): string[] {
      return texts(decoder.push(chunk));
    },
    end(): string[] {
      return texts(decoder.end());
    },
  };
}
