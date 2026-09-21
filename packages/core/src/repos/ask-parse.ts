import type { AskCandidate } from './ask-candidates';
import { applyAskReadGate } from './ask-loop';
import { splitAskStream } from './ask-stream';

/** Ask Asterism 的响应解析与引用校验：越界或未展开的引用在此被丢弃。 */

export interface AskRecommendation {
  repoId: string;
  /** 仅固定召回流程填写；Agent 路径为 null。 */
  index: number | null;
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
 * 解析 Agent 回答：正文必须非空；推荐必须是已 expand 的 repoId。
 * 缺少哨兵围栏不视为失败——正文照常呈现，推荐为空（ADR 0044 / 0045）。
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
    answer: {
      summary,
      recommendations: ids.map((repoId) => ({ repoId, index: null })),
    },
  };
}

/**
 * 固定召回流程：推荐体是候选索引，映射回 repoId（ADR 0042 降级）。
 */
export function parseAskFixedResponse(
  raw: string,
  candidates: readonly AskCandidate[],
): AskParseResult {
  const { body, recommendations: fenceBody } = splitAskStream(raw);
  const summary = body.trim();
  if (summary.length === 0) {
    return { ok: false, error: 'empty_summary' };
  }

  const values = fenceBody === null ? [] : parseRecommendationValues(fenceBody);
  const seen = new Set<number>();
  const recommendations: AskRecommendation[] = [];
  for (const value of values) {
    const index = typeof value === 'number' ? value : Number(value);
    if (!Number.isInteger(index)) {
      continue;
    }
    const candidate = candidates[index];
    if (!candidate || seen.has(index)) {
      continue;
    }
    seen.add(index);
    recommendations.push({ index, repoId: candidate.repoId });
    if (recommendations.length >= ASK_MAX_RECOMMENDATIONS) {
      break;
    }
  }

  return { ok: true, answer: { summary, recommendations } };
}
