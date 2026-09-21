import { describe, expect, it } from 'vitest';
import { ASK_RECOMMENDATIONS_FENCE, splitAskStream } from './ask-stream';

describe('splitAskStream', () => {
  it('returns the raw text when no sentinel is present', () => {
    expect(splitAskStream('Hello **world**.')).toEqual({
      body: 'Hello **world**.',
      recommendations: null,
    });
  });

  it('splits a completed sentinel fence from the prose', () => {
    const raw = [
      'Use [0] for the protocol layer.',
      '',
      `\`\`\`${ASK_RECOMMENDATIONS_FENCE}`,
      '[0, 2]',
      '```',
    ].join('\n');
    expect(splitAskStream(raw)).toEqual({
      body: 'Use [0] for the protocol layer.',
      recommendations: '[0, 2]',
    });
  });

  it('hides an unclosed sentinel so indexes never flash in the body', () => {
    const raw = `Answer so far.\n\`\`\`${ASK_RECOMMENDATIONS_FENCE}\n[0`;
    expect(splitAskStream(raw)).toEqual({
      body: 'Answer so far.',
      recommendations: null,
    });
  });

  it('strips a partial sentinel language prefix as soon as it is recognizable', () => {
    expect(splitAskStream('Hello\n```asterism-re')).toEqual({
      body: 'Hello',
      recommendations: null,
    });
  });

  it('does not strip an ordinary closed code fence', () => {
    const raw = 'See:\n```ts\nconst n = 1;\n```';
    expect(splitAskStream(raw)).toEqual({ body: raw, recommendations: null });
  });
});
