import { applyAskReadGate } from './ask-loop';
import { splitAskStream } from './ask-stream';

/** Ask Asterism 的响应解析与引用校验：未展开过的引用在此被丢弃。 */

export interface AskRecommendation {
  repoId: string;
}

export interface AskAnswer {
  summary: string;
  recommendations: AskRecommendation[];
}

export type AskParseResult =
  | { ok: true; answer: AskAnswer }
  | { ok: false; error: 'unparsable' }
  | { ok: false; error: 'empty_summary' };

/** 模型推荐数的硬上限；超出部分截断（防御性，正常 prompt 已要求 ≤5）。 */
export const ASK_MAX_RECOMMENDATIONS = 5;

function parseRecommendationValues(raw: string): unknown[] {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return trimmed.split(/[\s,]+/u).filter((part) => part.length > 0);
  }
}

function asRepoId(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

/**
 * 解析回答：正文必须非空；推荐必须是已 expand 的 repoId。
 * 缺少哨兵围栏不视为失败——正文照常呈现，推荐为空（ADR 0044 / 0045）。
 * 模型不会调工具时同样走这条路径，只是没有推荐卡片，正文仍然可读。
 */
export function parseAskResponse(
  raw: string,
  expandedRepoIds: ReadonlySet<string> | readonly string[],
): AskParseResult {
  const { body, recommendations: fenceBody } = splitAskStream(raw);
  const summary = body.trim();
  if (summary.length === 0) {
    return { ok: false, error: 'empty_summary' };
  }

  const values = fenceBody === null ? [] : parseRecommendationValues(fenceBody);
  const ids = applyAskReadGate(
    values.flatMap((value) => {
      const repoId = asRepoId(value);
      return repoId ? [repoId] : [];
    }),
    expandedRepoIds,
  ).slice(0, ASK_MAX_RECOMMENDATIONS);

  return {
    ok: true,
    answer: { summary, recommendations: ids.map((repoId) => ({ repoId })) },
  };
}
