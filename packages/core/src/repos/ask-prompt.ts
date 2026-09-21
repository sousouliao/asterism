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

export interface AskPrompt {
  system: string;
  user: string;
}

function languageRule(language?: string): string {
  return language
    ? `- Write the summary in this language: ${language}.`
    : '- Write the summary in the language of the question.';
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
