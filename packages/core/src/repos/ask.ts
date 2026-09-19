import type { Memory } from '../models/memory';
import type { StarredRepoLike } from './filter';
import { extractSnippet, type MatchReason, type MatchReasonKind } from './retrieval';

/**
 * Ask Asterism 领域逻辑（GitHub #41，ADR 0042）：
 * 个人库 Grounding 问答的召回、prompt 组装与响应校验，全部为纯函数。
 * 防幻觉由结构保证——模型只能以候选索引作答，界面只渲染通过校验的本地数据；
 * 召回为空时不发起生成，由调用方直接呈现固定的「未找到」文案。
 */

// ---------------------------------------------------------------------------
// Provider 注册表（OpenAI 兼容白名单）
// ---------------------------------------------------------------------------

export type AskProviderId = 'deepseek' | 'openai' | 'groq' | 'openrouter';

export interface AskProviderDefinition {
  id: AskProviderId;
  /** OpenAI 兼容 chat completions 的固定上游 base URL；Edge Function 侧维护同一白名单。 */
  baseUrl: string;
  defaultModel: string;
  /** 是否随请求启用 `response_format: json_object`（OpenRouter 依上游模型而定，默认不启用）。 */
  supportsJsonMode: boolean;
  /** 界面 Provider 名称的 i18n key。 */
  labelKey: string;
}

export const ASK_PROVIDERS: readonly AskProviderDefinition[] = [
  {
    id: 'deepseek',
    baseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    supportsJsonMode: true,
    labelKey: 'ask.provider.deepseek',
  },
  {
    id: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    supportsJsonMode: true,
    labelKey: 'ask.provider.openai',
  },
  {
    id: 'groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    supportsJsonMode: true,
    labelKey: 'ask.provider.groq',
  },
  {
    id: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openrouter/auto',
    supportsJsonMode: false,
    labelKey: 'ask.provider.openrouter',
  },
];

export function findAskProvider(id: string): AskProviderDefinition | undefined {
  return ASK_PROVIDERS.find((provider) => provider.id === id);
}

// ---------------------------------------------------------------------------
// 连接能力读取（ADR 0043；自旧 Generation Registry 的 capability 读取原样迁移）
// ---------------------------------------------------------------------------

/** 一次连接探针的结论投影；`reason` 沿用旧探针词汇供界面映射失败原因。 */
export interface GenerationCapabilityView {
  ok: boolean;
  model: string | null;
  testedAt: string | null;
  reason: string | null;
}

export function readGenerationCapability(capability: unknown): GenerationCapabilityView | null {
  if (capability === null || typeof capability !== 'object') {
    return null;
  }
  const record = capability as Record<string, unknown>;
  if (typeof record.ok !== 'boolean') {
    return null;
  }
  const model = typeof record.model === 'string' ? record.model.trim() : '';
  return {
    ok: record.ok,
    model: model.length > 0 ? model : null,
    testedAt: typeof record.testedAt === 'string' ? record.testedAt : null,
    reason: typeof record.reason === 'string' ? record.reason : null,
  };
}

/** 连接通过能力测试时证明过的唯一模型；未测试或失败返回 null。 */
export function readTestedModel(capability: unknown): string | null {
  const parsed = readGenerationCapability(capability);
  return parsed?.ok ? parsed.model : null;
}

// ---------------------------------------------------------------------------
// 召回：自然语言问题 → 个人库候选
// ---------------------------------------------------------------------------

export interface AskCandidate<T extends StarredRepoLike = StarredRepoLike> {
  item: T;
  repoId: string;
  /** 词法得分（越高越相关）；语义补充候选为 null，不与词法分比较。 */
  lexicalScore: number | null;
  /** 问题向量与仓库向量的语义距离；仅语义补充候选携带。 */
  semanticDistance?: number;
  /** 命中理由（按展示优先级排序），供界面渲染可验证的证据标签。 */
  reasons: MatchReason[];
}

export interface SelectAskCandidatesInput<T extends StarredRepoLike> {
  question: string;
  items: readonly T[];
  memoriesByRepoId?: ReadonlyMap<string, Memory>;
  /** repoId → 语义距离；未授权 embedding 时缺省，召回退化为纯词法。 */
  distanceByRepoId?: ReadonlyMap<string, number>;
  limit?: number;
}

/** 送入 prompt 的候选上限：约束上下文规模，也让引用索引保持短小。 */
export const ASK_CANDIDATE_LIMIT = 12;

/** 问题虚词（英文疑问/功能词 + 中文黏着词）；实义词（含「支持」「轻量」等）一律保留参与匹配。 */
const ENGLISH_STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'of',
  'for',
  'with',
  'in',
  'on',
  'to',
  'at',
  'by',
  'from',
  'up',
  'about',
  'into',
  'over',
  'after',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'do',
  'does',
  'did',
  'have',
  'has',
  'had',
  'i',
  'my',
  'me',
  'we',
  'our',
  'you',
  'your',
  'it',
  'its',
  'this',
  'that',
  'these',
  'those',
  'which',
  'what',
  'who',
  'when',
  'where',
  'why',
  'how',
  'can',
  'could',
  'should',
  'would',
  'will',
  'shall',
  'may',
  'might',
  'must',
  'any',
  'some',
  'all',
  'both',
  'each',
  'few',
  'more',
  'most',
  'other',
  'such',
  'no',
  'nor',
  'not',
  'only',
  'own',
  'same',
  'so',
  'than',
  'too',
  'very',
  'there',
  'here',
  'past',
]);

const CHINESE_STOPWORDS = new Set([
  '的',
  '了',
  '和',
  '是',
  '我',
  '你',
  '他',
  '她',
  '它',
  '们',
  '有',
  '在',
  '中',
  '吗',
  '呢',
  '吧',
  '啊',
  '过',
  '之前',
  '哪些',
  '哪个',
  '什么',
  '怎么',
  '怎样',
  '如何',
]);

/**
 * 把自然语言问题拆成检索词：拉丁词（≥2 字符，含 c++/c# 等写法）与中文连续段 bigram。
 * 无效 bigram（如「持且」）不会命中任何仓库文本，自然消亡，无需额外过滤。
 */
export function tokenizeQuestion(question: string): string[] {
  const terms = new Set<string>();
  const latinWords = question.toLowerCase().match(/[a-z0-9][a-z0-9+#.-]*/g) ?? [];
  for (const word of latinWords) {
    if (word.length >= 2 && !ENGLISH_STOPWORDS.has(word)) {
      terms.add(word);
    }
  }
  for (const run of question.match(/[\u4e00-\u9fff]+/g) ?? []) {
    if (run.length === 1) {
      if (!CHINESE_STOPWORDS.has(run)) {
        terms.add(run);
      }
      continue;
    }
    for (let start = 0; start + 1 < run.length; start += 1) {
      const bigram = run.slice(start, start + 2);
      if (!CHINESE_STOPWORDS.has(bigram)) {
        terms.add(bigram);
      }
    }
  }
  return [...terms];
}

function lexicalScoreForTerm(
  item: StarredRepoLike,
  term: string,
  memory: Memory | undefined,
  reasons: MatchReason[],
  seenKinds: Set<MatchReasonKind>,
): number {
  const { repo } = item;
  const whySaved = memory?.whySaved?.trim();
  const note = memory?.note?.trim();
  const description = repo.description?.trim();

  // 每类字段只记录第一条命中理由，避免同字段多词重复堆叠；摘录与统一检索同源。
  if (!seenKinds.has('why_saved') && whySaved?.toLowerCase().includes(term)) {
    seenKinds.add('why_saved');
    reasons.push({
      kind: 'why_saved',
      snippet: extractSnippet(whySaved, term),
      fullText: whySaved,
    });
  }
  if (!seenKinds.has('note') && note?.toLowerCase().includes(term)) {
    seenKinds.add('note');
    reasons.push({ kind: 'note', snippet: extractSnippet(note, term), fullText: note });
  }
  if (!seenKinds.has('name') && repo.name.toLowerCase().includes(term)) {
    seenKinds.add('name');
    reasons.push({ kind: 'name', snippet: repo.fullName, fullText: repo.fullName });
  }
  if (!seenKinds.has('topic')) {
    const topic = repo.topics.find((entry) => entry.toLowerCase() === term);
    if (topic) {
      seenKinds.add('topic');
      reasons.push({ kind: 'topic', snippet: topic, fullText: topic, matchedField: topic });
    }
  }
  if (!seenKinds.has('description') && description?.toLowerCase().includes(term)) {
    seenKinds.add('description');
    reasons.push({
      kind: 'description',
      snippet: extractSnippet(description, term),
      fullText: description,
    });
  }

  let score = 0;
  if (whySaved?.toLowerCase().includes(term)) score += 5;
  if (note?.toLowerCase().includes(term)) score += 4;
  if (repo.name.toLowerCase().includes(term)) score += 4;
  if (repo.language?.toLowerCase() === term) score += 3;
  if (repo.topics.some((entry) => entry.toLowerCase() === term)) score += 3;
  if (description?.toLowerCase().includes(term)) score += 2;
  return score;
}

/** 词法候选的最低门槛：低于 2 分（如仅命中一个弱信号）视为噪音。 */
const MINIMUM_LEXICAL_SCORE = 2;

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** 证据理由展示优先级：个人 Memory > 名称 > 描述 / 主题 > 语义近邻（对齐统一检索）。 */
const ASK_REASON_PRECEDENCE: Record<MatchReasonKind, number> = {
  why_saved: 1,
  note: 2,
  name: 3,
  description: 4,
  topic: 5,
  semantic_repo: 6,
};

function orderReasons(reasons: MatchReason[]): MatchReason[] {
  return [...reasons].sort(
    (left, right) =>
      (ASK_REASON_PRECEDENCE[left.kind] ?? 99) - (ASK_REASON_PRECEDENCE[right.kind] ?? 99) ||
      compareStrings(left.kind, right.kind),
  );
}

/**
 * 个人库问答召回：多词词法评分（个人 Memory 权重高于客观元数据，对齐统一检索的理由优先级），
 * 再按语义距离补充未命中词法的近邻（embedding 未授权时纯词法）。
 * 排序完全确定：词法分 → star 数 → fullName → repoId；语义补充按距离 → fullName。
 */
export function selectAskCandidates<T extends StarredRepoLike>({
  question,
  items,
  memoriesByRepoId,
  distanceByRepoId,
  limit = ASK_CANDIDATE_LIMIT,
}: SelectAskCandidatesInput<T>): AskCandidate<T>[] {
  const terms = tokenizeQuestion(question);
  if (terms.length === 0) {
    return [];
  }

  const lexical: AskCandidate<T>[] = [];
  const matchedRepoIds = new Set<string>();
  for (const item of items) {
    const repoId = item.repoId;
    if (!repoId) {
      continue;
    }
    const memory = memoriesByRepoId?.get(repoId);
    const reasons: MatchReason[] = [];
    const seenKinds = new Set<MatchReasonKind>();
    let score = 0;
    for (const term of terms) {
      score += lexicalScoreForTerm(item, term, memory, reasons, seenKinds);
    }
    if (score >= MINIMUM_LEXICAL_SCORE) {
      matchedRepoIds.add(repoId);
      lexical.push({ item, repoId, lexicalScore: score, reasons: orderReasons(reasons) });
    }
  }

  lexical.sort((left, right) => {
    const scoreDelta =
      (right.lexicalScore ?? 0) - (left.lexicalScore ?? 0) ||
      right.item.repo.stargazers - left.item.repo.stargazers ||
      compareStrings(left.item.repo.fullName, right.item.repo.fullName) ||
      compareStrings(left.repoId, right.repoId);
    return scoreDelta;
  });

  if (!distanceByRepoId || distanceByRepoId.size === 0) {
    return lexical.slice(0, limit);
  }

  const semantic: AskCandidate<T>[] = [];
  for (const item of items) {
    const repoId = item.repoId;
    if (!repoId || matchedRepoIds.has(repoId)) {
      continue;
    }
    const distance = distanceByRepoId.get(repoId);
    if (distance !== undefined) {
      semantic.push({
        item,
        repoId,
        lexicalScore: null,
        semanticDistance: distance,
        reasons: [
          {
            kind: 'semantic_repo',
            snippet: item.repo.description?.trim() || undefined,
            fullText: item.repo.description?.trim() || undefined,
          },
        ],
      });
    }
  }
  semantic.sort(
    (left, right) =>
      (left.semanticDistance ?? 0) - (right.semanticDistance ?? 0) ||
      compareStrings(left.item.repo.fullName, right.item.repo.fullName),
  );

  return [...lexical, ...semantic].slice(0, limit);
}

// ---------------------------------------------------------------------------
// Prompt 组装
// ---------------------------------------------------------------------------

/** 一轮已完成的问答（追问上下文；每轮召回仍以当前问题重新计算）。 */
export interface AskExchange {
  question: string;
  summary: string;
}

export interface BuildAskPromptInput<T extends StarredRepoLike> {
  question: string;
  candidates: readonly AskCandidate<T>[];
  memoriesByRepoId?: ReadonlyMap<string, Memory>;
  /** 此前的问答轮次，仅作为对话语境，不携带旧候选。 */
  history?: readonly AskExchange[];
  /** 回答语言（BCP 47 标签，跟随界面语言；缺省由模型跟随问题语言）。 */
  language?: string;
  /** 是否把 Memory 笔记（whySaved / note）写进 prompt；缺省包含（ADR 0042 同意范围）。 */
  includeNotes?: boolean;
}

export interface AskPrompt {
  system: string;
  user: string;
}

function formatCandidateBlock<T extends StarredRepoLike>(
  candidate: AskCandidate<T>,
  index: number,
  memory?: Memory,
  includeNotes = true,
): string {
  const { repo } = candidate.item;
  const lines = [`[${index}] ${repo.fullName} — ${repo.description?.trim() || 'No description'}`];
  const meta = [
    repo.language ? `Language: ${repo.language}` : null,
    `Stars: ${repo.stargazers}`,
    repo.topics.length > 0 ? `Topics: ${repo.topics.join(', ')}` : null,
  ].filter((part): part is string => part !== null);
  lines.push(`    ${meta.join(' · ')}`);
  if (!includeNotes) {
    return lines.join('\n');
  }
  const whySaved = memory?.whySaved?.trim();
  if (whySaved) {
    lines.push(`    Why saved (user's own note): ${whySaved}`);
  }
  const note = memory?.note?.trim();
  if (note) {
    lines.push(`    Note (user's own note): ${note}`);
  }
  return lines.join('\n');
}

/**
 * 组装 Grounding prompt：候选以带索引的结构化文本给出，模型被限定只能引用这些索引，
 * 并以严格 JSON 返回（summary + 推荐索引）。引用校验在 parseAskResponse 完成。
 */
export function buildAskPrompt<T extends StarredRepoLike>({
  question,
  candidates,
  memoriesByRepoId,
  history,
  language,
  includeNotes = true,
}: BuildAskPromptInput<T>): AskPrompt {
  const system = [
    'You are Ask Asterism, the question-answering assistant of a personal open-source memory app.',
    "You answer questions strictly from the numbered repository candidates supplied in the user message. Each candidate is a repository the user saved on GitHub, with its metadata and, when present, the user's private memory notes.",
    '',
    'Rules:',
    '- Ground every claim in the candidates. Never invent, rename, or assume repositories that are not in the candidate list.',
    '- Quote or paraphrase the user\'s own memory text ("Why saved" / "Note") only when the candidate actually contains it; never fabricate memory content.',
    "- If no candidate answers the question, say so plainly: the user's collection has no match for it. Do not suggest alternatives outside the collection.",
    '- Keep repository names exactly as written. Refer to a candidate by its bracketed index, e.g. [0] or [2].',
    language
      ? `- Write the summary in this language: ${language}.`
      : '- Write the summary in the language of the question.',
    '',
    'Respond with strict JSON only, no markdown fences, in this exact shape:',
    '{"summary": string, "recommendations": number[]}',
    '- summary: 2-6 sentences answering the question, citing candidates by their bracketed index where they support a claim.',
    '- recommendations: the indexes of candidates that genuinely answer the question, best first, at most 5. Use [] when none match.',
  ].join('\n');

  const sections: string[] = [`Question: ${question}`];
  if (history && history.length > 0) {
    sections.push(
      'Previous turns of this conversation (context only; their repositories are NOT available unless relisted below):',
      ...history.map((exchange) => `Q: ${exchange.question}\nA: ${exchange.summary}`),
    );
  }
  sections.push(
    `Candidates from the user's collection:`,
    ...candidates.map((candidate, index) =>
      formatCandidateBlock(
        candidate,
        index,
        candidate.repoId ? memoriesByRepoId?.get(candidate.repoId) : undefined,
        includeNotes,
      ),
    ),
  );

  return { system, user: sections.join('\n\n') };
}

// ---------------------------------------------------------------------------
// 响应解析与引用校验
// ---------------------------------------------------------------------------

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
