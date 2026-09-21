import { describe, expect, it } from 'vitest';
import { createAskSseDecoder, createOpenAiDeltaDecoder, encodeAskSseEvent } from './ask-sse';

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
  it('round-trips delta, error and done events', () => {
    const encoded =
      encodeAskSseEvent({ event: 'delta', text: 'Hello' }) +
      encodeAskSseEvent({ event: 'error', status: 'timeout' }) +
      encodeAskSseEvent({ event: 'done' });
    const decoder = createAskSseDecoder();
    expect(decoder.push(encoded)).toEqual([
      { event: 'delta', text: 'Hello' },
      { event: 'error', status: 'timeout' },
      { event: 'done' },
    ]);
  });
});
