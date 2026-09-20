import type { Memory } from '../models/memory';
import type { StarredRepoLike } from './filter';
import { extractSnippet, type MatchReason, type MatchReasonKind } from './retrieval';

/**
 * Ask Asterism 召回（GitHub #41，ADR 0042）：自然语言问题 → 个人库候选。
 * 纯词法打分 + 可选语义补充，全部为纯函数，不依赖运行环境。
 */

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
