import type { AskCandidate } from './ask-candidates';
import { splitAskStream } from './ask-stream';

/** Ask Asterism 的响应解析与引用校验：越界或伪造的引用在此被丢弃。 */

export interface AskRecommendation {
  /** 候选索引（已通过 ∈ [0, candidates.length) 校验）。 */
  index: number;
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

function mapRecommendations(
  values: readonly unknown[],
  candidates: readonly AskCandidate[],
): AskRecommendation[] {
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
  return recommendations;
}

/**
 * 解析并校验模型回答：正文必须非空；推荐索引必须落在候选集内，
 * 越界 / 非整数 / 重复一律丢弃，映射回 repoId 后才允许进入界面。
 * 缺少哨兵围栏不视为失败——正文照常呈现，推荐为空（ADR 0044）。
 */
export function parseAskResponse(raw: string, candidates: readonly AskCandidate[]): AskParseResult {
  const { body, recommendations: fenceBody } = splitAskStream(raw);
  const summary = body.trim();
  if (summary.length === 0) {
    return { ok: false, error: 'empty_summary' };
  }

  return {
    ok: true,
    answer: {
      summary,
      recommendations:
        fenceBody === null
          ? []
          : mapRecommendations(parseRecommendationValues(fenceBody), candidates),
    },
  };
}
