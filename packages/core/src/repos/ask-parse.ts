import type { AskCandidate } from './ask-candidates';

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

/** 从模型输出中提取 JSON：容忍 markdown 围栏与前后杂讯，取首个配平的顶层对象。 */
function extractJsonObject(raw: string): unknown {
  const fenced = raw.replace(/```(?:json)?/gi, '').trim();
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start === -1 || end <= start) {
    return undefined;
  }
  try {
    return JSON.parse(fenced.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

/**
 * 解析并校验模型回答：summary 必须是非空字符串；推荐索引必须落在候选集内，
 * 越界 / 非整数 / 重复一律丢弃，映射回 repoId 后才允许进入界面。
 */
export function parseAskResponse(raw: string, candidates: readonly AskCandidate[]): AskParseResult {
  const parsed = extractJsonObject(raw);
  if (parsed === null || typeof parsed !== 'object') {
    return { ok: false, error: 'unparsable' };
  }

  const summary = (parsed as { summary?: unknown }).summary;
  if (typeof summary !== 'string' || summary.trim().length === 0) {
    return { ok: false, error: 'empty_summary' };
  }

  const rawRecommendations = (parsed as { recommendations?: unknown }).recommendations;
  const indexes = Array.isArray(rawRecommendations) ? rawRecommendations : [];
  const seen = new Set<number>();
  const recommendations: AskRecommendation[] = [];
  for (const value of indexes) {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      continue;
    }
    const candidate = candidates[value];
    if (!candidate || seen.has(value)) {
      continue;
    }
    seen.add(value);
    recommendations.push({ index: value, repoId: candidate.repoId });
    if (recommendations.length >= ASK_MAX_RECOMMENDATIONS) {
      break;
    }
  }

  return { ok: true, answer: { summary: summary.trim(), recommendations } };
}
