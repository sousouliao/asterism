import type { StarredRepoLike } from './filter';
import type { MatchReason } from './retrieval';

/**
 * Ask Asterism 的问题分词与推荐载体（GitHub #41，ADR 0042 / 0046）。
 * 召回由 `ask-tools` 的 search/filter 承担，这里只保留分词与界面渲染用的候选结构。
 */

export interface AskCandidate<T extends StarredRepoLike = StarredRepoLike> {
  item: T;
  repoId: string;
  /** 词法得分（越高越相关）；Agent 推荐不打分时为 null。 */
  lexicalScore: number | null;
  /** 问题向量与仓库向量的语义距离；仅语义补充候选携带。 */
  semanticDistance?: number;
  /** 命中理由（按展示优先级排序），供界面渲染可验证的证据标签。 */
  reasons: MatchReason[];
}

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
