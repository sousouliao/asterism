import { describe, expect, it } from 'vitest';
import {
  ASK_SESSION_MAX_CEILING,
  type AskSessionRecord,
  applySessionEviction,
  formatSessionTitle,
} from './ask-session-storage';

function makeSession(id: string, updatedAt: number): AskSessionRecord {
  return {
    id,
    title: `Session ${id}`,
    createdAt: updatedAt - 1000,
    updatedAt,
    turns: [],
  };
}

describe('applySessionEviction', () => {
  const now = 1_000_000_000;
  const oneDay = 24 * 60 * 60 * 1000;

  it('returns empty array when given empty list', () => {
    expect(applySessionEviction([], now)).toEqual([]);
  });

  it('keeps all sessions within 7 days if count >= 5 and <= 30', () => {
    const sessions = [
      makeSession('1', now - oneDay),
      makeSession('2', now - 2 * oneDay),
      makeSession('3', now - 3 * oneDay),
      makeSession('4', now - 4 * oneDay),
      makeSession('5', now - 5 * oneDay),
      makeSession('6', now - 6 * oneDay),
      makeSession('old-1', now - 8 * oneDay),
      makeSession('old-2', now - 9 * oneDay),
    ];

    const result = applySessionEviction(sessions, now);
    expect(result.map((s) => s.id)).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  it('preserves up to MIN_FLOOR sessions even if all are older than 7 days (vacation scenario)', () => {
    const sessions = [
      makeSession('old-1', now - 10 * oneDay),
      makeSession('old-2', now - 12 * oneDay),
      makeSession('old-3', now - 14 * oneDay),
    ];

    const result = applySessionEviction(sessions, now);
    expect(result.map((s) => s.id)).toEqual(['old-1', 'old-2', 'old-3']);
  });

  it('preserves top MIN_FLOOR sessions if many are older than 7 days and recent count is under floor', () => {
    const sessions = [
      makeSession('recent-1', now - oneDay),
      makeSession('recent-2', now - 2 * oneDay),
      makeSession('old-1', now - 8 * oneDay),
      makeSession('old-2', now - 9 * oneDay),
      makeSession('old-3', now - 10 * oneDay),
      makeSession('old-4', now - 11 * oneDay),
      makeSession('old-5', now - 12 * oneDay),
    ];

    const result = applySessionEviction(sessions, now);
    // Since only 2 are within 7 days (< MIN_FLOOR = 5), it keeps the 5 newest
    expect(result.map((s) => s.id)).toEqual(['recent-1', 'recent-2', 'old-1', 'old-2', 'old-3']);
  });

  it('caps sessions to MAX_CEILING (30)', () => {
    const sessions = Array.from({ length: 45 }, (_, i) => makeSession(`s-${i}`, now - i * 1000));

    const result = applySessionEviction(sessions, now);
    expect(result.length).toBe(ASK_SESSION_MAX_CEILING);
    expect(result[0]?.id).toBe('s-0');
    expect(result[29]?.id).toBe('s-29');
  });
});

describe('formatSessionTitle', () => {
  it('preserves short questions', () => {
    expect(formatSessionTitle('Which rust websocket library?')).toBe(
      'Which rust websocket library?',
    );
  });

  it('truncates long questions to 40 characters with ellipsis', () => {
    const long =
      'What is the best library for building reactive streaming pipelines in modern frontend web apps?';
    const formatted = formatSessionTitle(long);
    expect(formatted.length).toBe(40);
    expect(formatted.endsWith('…')).toBe(true);
  });

  it('collapses multiple whitespace characters', () => {
    expect(formatSessionTitle('  Hello    world \n\t question  ')).toBe('Hello world question');
  });
});
