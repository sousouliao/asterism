import { describe, expect, it } from 'vitest';
import {
  createAskSseDecoder,
  createOpenAiDeltaDecoder,
  createOpenAiStreamDecoder,
  createOpenAiToolCallAssembler,
  encodeAskSseEvent,
} from './ask-sse';

describe('createOpenAiDeltaDecoder', () => {
  it('extracts content deltas and ignores [DONE]', () => {
    const decoder = createOpenAiDeltaDecoder();
    const first = decoder.push(
      `data: ${JSON.stringify({ choices: [{ delta: { content: 'Hel' } }] })}\n\n`,
    );
    const split = decoder.push(
      `data: ${JSON.stringify({ choices: [{ delta: { content: 'lo' } }] })}\n\ndata: [DONE]\n\n`,
    );
    expect([...first, ...split, ...decoder.end()]).toEqual(['Hel', 'lo']);
  });

  it('reassembles a data line split across chunks', () => {
    const decoder = createOpenAiDeltaDecoder();
    const payload = JSON.stringify({ choices: [{ delta: { content: 'Hi' } }] });
    expect(decoder.push(`data: ${payload.slice(0, 12)}`)).toEqual([]);
    expect(decoder.push(`${payload.slice(12)}\n\n`)).toEqual(['Hi']);
  });
});

describe('ask sse protocol', () => {
  it('round-trips delta, tool_call, error and done events', () => {
    const encoded =
      encodeAskSseEvent({ event: 'delta', text: 'Hello' }) +
      encodeAskSseEvent({
        event: 'tool_call',
        id: 'call_1',
        name: 'expand',
        arguments: '{"ids":["axum"]}',
      }) +
      encodeAskSseEvent({ event: 'error', status: 'timeout' }) +
      encodeAskSseEvent({ event: 'done' });
    const decoder = createAskSseDecoder();
    expect(decoder.push(encoded)).toEqual([
      { event: 'delta', text: 'Hello' },
      { event: 'tool_call', id: 'call_1', name: 'expand', arguments: '{"ids":["axum"]}' },
      { event: 'error', status: 'timeout' },
      { event: 'done' },
    ]);
  });
});

describe('createOpenAiStreamDecoder', () => {
  it('reassembles fragmented tool_calls across chunks', () => {
    const decoder = createOpenAiStreamDecoder();
    const assembler = createOpenAiToolCallAssembler();
    const first = decoder.push(
      `data: ${JSON.stringify({
        choices: [
          {
            delta: {
              tool_calls: [{ index: 0, id: 'call_1', function: { name: 'expand', arguments: '' } }],
            },
          },
        ],
      })}\n\n`,
    );
    const second = decoder.push(
      `data: ${JSON.stringify({
        choices: [
          {
            delta: { tool_calls: [{ index: 0, function: { arguments: '{"ids":["axum"]}' } }] },
            finish_reason: 'tool_calls',
          },
        ],
      })}\n\n`,
    );
    for (const part of [...first, ...second, ...decoder.end()]) {
      assembler.push(part);
    }
    expect(assembler.finish()).toEqual([
      { id: 'call_1', name: 'expand', arguments: '{"ids":["axum"]}' },
    ]);
  });
});
