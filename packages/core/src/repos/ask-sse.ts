/**
 * Ask 的 SSE 编解码：零依赖叶子文件，供 Edge Function 与 `@asterism/db` 共用。
 *
 * Asterism 协议（生成动作下发，不是上游透传）：
 *   event: delta  → {"text":"..."}
 *   event: error  → {"status":"timeout"|"retryable_error"|...}
 *   event: done   → {}
 */

export const ASK_SSE_ERROR_STATUSES = [
  'invalid_provider_key',
  'provider_rejected',
  'timeout',
  'retryable_error',
] as const;

export type AskSseErrorStatus = (typeof ASK_SSE_ERROR_STATUSES)[number];

export type AskSseEvent =
  | { event: 'delta'; text: string }
  | { event: 'error'; status: AskSseErrorStatus }
  | { event: 'done' };

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

function extractOpenAiDelta(block: string): string | null {
  const payload = dataPayload(block);
  if (payload === null || payload === '[DONE]') {
    return null;
  }
  try {
    const parsed = JSON.parse(payload) as {
      choices?: { delta?: { content?: unknown } }[];
    };
    const content = parsed.choices?.[0]?.delta?.content;
    return typeof content === 'string' && content.length > 0 ? content : null;
  } catch {
    return null;
  }
}

/**
 * 增量解码 OpenAI 兼容 `chat.completions` SSE，吐出文本 delta。
 */
export function createOpenAiDeltaDecoder(): {
  push: (chunk: string) => string[];
  end: () => string[];
} {
  let buffer = '';
  const take = (source: string, flush: boolean): string[] => {
    const { blocks, rest } = splitCompleteBlocks(source);
    buffer = rest;
    const deltas: string[] = [];
    for (const block of blocks) {
      const text = extractOpenAiDelta(block);
      if (text) {
        deltas.push(text);
      }
    }
    if (flush && buffer.trim().length > 0) {
      const text = extractOpenAiDelta(buffer);
      buffer = '';
      if (text) {
        deltas.push(text);
      }
    }
    return deltas;
  };

  return {
    push(chunk: string): string[] {
      return take(buffer + normalizeNewlines(chunk), false);
    },
    end(): string[] {
      return take(buffer, true);
    },
  };
}
