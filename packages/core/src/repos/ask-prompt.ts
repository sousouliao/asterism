import type { Memory } from '../models/memory';
import type { AskCandidate } from './ask-candidates';
import type { StarredRepoLike } from './filter';

/** 一轮已完成的问答（追问上下文；目录常驻，旧仓库不必重列）。 */
export interface AskExchange {
  question: string;
  summary: string;
}

export interface BuildAskPromptInput {
  question: string;
  catalog: string;
  history?: readonly AskExchange[];
  language?: string;
  includeNotes?: boolean;
}

export interface BuildAskFixedPromptInput<T extends StarredRepoLike> {
  question: string;
  candidates: readonly AskCandidate<T>[];
  memoriesByRepoId?: ReadonlyMap<string, Memory>;
  history?: readonly AskExchange[];
  language?: string;
  includeNotes?: boolean;
}

export interface AskPrompt {
  system: string;
  user: string;
}

function languageRule(language?: string): string {
  return language
    ? `- Write the summary in this language: ${language}.`
    : '- Write the summary in the language of the question.';
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

function outputRules(): string[] {
  return [
    'Respond in Markdown (not JSON). After the answer, emit exactly one fenced block whose language tag is asterism-recommendations and whose body is a JSON array of repoId strings.',
    'Allowed Markdown: paragraphs, lists, bold, italics, inline code, and fenced code blocks. Do not use images, raw HTML, or tables.',
    'End with this block and nothing after it:',
    '```asterism-recommendations',
    '["repo-id-1", "repo-id-2"]',
    '```',
    '- The prose answers the question, citing repositories by repoId or fullName where they support a claim.',
    '- The recommendations array lists repoId values that genuinely answer the question, best first, at most 5. Use [] when none match.',
  ];
}

/**
 * 目录常驻 Agent 的 Grounding prompt（ADR 0045）。
 * system 含规则 + 稳定目录，便于前缀缓存；user 只放历史与当前问题。
 */
export function buildAskPrompt({
  question,
  catalog,
  history,
  language,
  includeNotes = true,
}: BuildAskPromptInput): AskPrompt {
  const system = [
    'You are Ask Asterism, the question-answering assistant of a personal open-source memory app.',
    "You answer from the user's GitHub starred collection. A catalog of that collection is embedded below. Private Memory notes (why saved / note) are NOT in the catalog — call expand to read them.",
    '',
    'Tools:',
    '- filter: exact structured filter (language, topics, name, star dates). Returns the full matching set in pages plus the total count.',
    '- search: lexical search with no minimum score. Use for fuzzy wording.',
    '- expand: read full metadata and Memory notes for specific repoId values.',
    '',
    'Rules:',
    '- You MUST call expand on a repository before recommending it. Catalog lines are not enough.',
    '- Never invent, rename, or assume repositories that are not in the catalog or a tool result.',
    "- Quote the user's own memory text only after expand returned it; never fabricate notes.",
    '- If the collection has no match, say so plainly. Do not suggest repositories outside the collection.',
    '- Keep repository names exactly as written. Refer to a repository by repoId or fullName.',
    languageRule(language),
    includeNotes
      ? '- Memory notes may be sent when you expand a repository.'
      : '- The user disabled sending Memory notes. expand will omit whySaved / note.',
    '',
    ...outputRules(),
    '',
    catalog,
  ].join('\n');

  const sections: string[] = [];
  if (history && history.length > 0) {
    sections.push(
      'Previous turns of this conversation. The catalog above still applies; those repositories remain available:',
      ...history.map((exchange) => `Q: ${exchange.question}\nA: ${exchange.summary}`),
    );
  }
  sections.push(`Question: ${question}`);

  return { system, user: sections.join('\n\n') };
}

/**
 * 能力不足时的固定召回流程（ADR 0042 降级）：编号候选 + 单次生成。
 */
export function buildAskFixedPrompt<T extends StarredRepoLike>({
  question,
  candidates,
  memoriesByRepoId,
  history,
  language,
  includeNotes = true,
}: BuildAskFixedPromptInput<T>): AskPrompt {
  const system = [
    'You are Ask Asterism, the question-answering assistant of a personal open-source memory app.',
    "You answer questions strictly from the numbered repository candidates supplied in the user message. Each candidate is a repository the user saved on GitHub, with its metadata and, when present, the user's private memory notes.",
    '',
    'Rules:',
    '- Ground every claim in the candidates. Never invent, rename, or assume repositories that are not in the candidate list.',
    '- Quote or paraphrase the user\'s own memory text ("Why saved" / "Note") only when the candidate actually contains it; never fabricate memory content.',
    "- If no candidate answers the question, say so plainly: the user's collection has no match for it. Do not suggest alternatives outside the collection.",
    '- Keep repository names exactly as written. Refer to a candidate by its bracketed index, e.g. [0] or [2].',
    languageRule(language),
    '',
    'Respond in Markdown (not JSON). After the answer, emit exactly one fenced block whose language tag is asterism-recommendations and whose body is a JSON array of candidate indexes.',
    'Allowed Markdown: paragraphs, lists, bold, italics, inline code, and fenced code blocks. Do not use images, raw HTML, or tables.',
    'End with this block and nothing after it:',
    '```asterism-recommendations',
    '[0, 2]',
    '```',
    '- The prose (2-6 sentences) answers the question, citing candidates by their bracketed index where they support a claim.',
    '- The recommendations array lists indexes that genuinely answer the question, best first, at most 5. Use [] when none match.',
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
