import type { Memory } from '../models/memory';
import type { AskCandidate } from './ask-candidates';
import type { StarredRepoLike } from './filter';

/** Ask Asterism 的 Grounding prompt 组装：模型只能引用带索引的本地候选。 */

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
