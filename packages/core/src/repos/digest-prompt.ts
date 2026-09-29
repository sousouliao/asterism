export interface RepoDigestData {
  definition: string;
  painPoint: string;
  scenarios: string;
}

export interface BuildRepoDigestPromptInput {
  fullName: string;
  description?: string | null;
  language?: string | null;
  topics?: readonly string[];
  readme?: string | null;
  targetLocale?: string;
}

export interface RepoDigestPrompt {
  system: string;
  user: string;
}

/**
 * 清洗并截取用于速读提炼的 README 核心文本。
 * 1. 过滤 HTML 标签、脚本、样式与 SVG
 * 2. 过滤 Markdown 徽章与图片
 * 3. 截断尾部 License / Contributing / Sponsors 等低信息密度章节
 * 4. 限制在约 2,500 字符内，保障超低 Token 消耗与最高信息密度
 */
export function cleanReadmeForDigest(content: string | null | undefined, maxChars = 2500): string {
  if (!content) return '';

  let text = content;

  // 1. 移除脚本、样式与 SVG
  text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  text = text.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '');

  // 2. 移除 HTML 注释与标签
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  text = text.replace(/<\/?[a-zA-Z][^>]*>/g, ' ');

  // 3. 移除 Markdown 徽章与图片
  text = text.replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, '');
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, '');

  // 4. 移除尾部低价值章节（License, Contributing, Sponsors, Changelog, Acknowledgements 等）
  const tailHeadingRegex =
    /\n[ \t]*#{1,4}\s*(?:license|licence|contributing|contributors|sponsors|funding|changelog|acknowledgements|acknowledgments|community)\b[\s\S]*/i;
  text = text.replace(tailHeadingRegex, '');

  // 5. 规范化空白字符
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n\s*\n\s*\n+/g, '\n\n');
  text = text.trim();

  // 6. 安全截断
  if (text.length <= maxChars) {
    return text;
  }

  const truncated = text.slice(0, maxChars);
  const lastParagraph = truncated.lastIndexOf('\n\n');
  if (lastParagraph > maxChars * 0.75) {
    return truncated.slice(0, lastParagraph).trim();
  }
  const lastSentence = Math.max(truncated.lastIndexOf('. '), truncated.lastIndexOf('。'));
  if (lastSentence > maxChars * 0.75) {
    return truncated.slice(0, lastSentence + 1).trim();
  }
  return truncated.trim();
}

/**
 * 依据 Matt Pocock 的 writing-for-agents 契约构建的速读提炼 Prompt。
 * - Positive directives（无负向诱导）
 * - Leading words（原型、机制瓶颈、调用主体）
 * - Co-located field directives（规则就地归拢）
 */
export function buildRepoDigestPrompt({
  fullName,
  description,
  language,
  topics = [],
  readme,
  targetLocale = 'zh-CN',
}: BuildRepoDigestPromptInput): RepoDigestPrompt {
  const isZh = targetLocale.startsWith('zh');

  const system = [
    'Extract a 3-point technical summary for developers evaluating an open-source repository.',
    '',
    'Grounding:',
    'Derive all statements strictly from explicit facts in the provided metadata and README excerpt.',
    '',
    'Output Format:',
    'Emit solely a valid JSON object matching:',
    '{',
    '  "definition": "string",',
    '  "painPoint": "string",',
    '  "scenarios": "string"',
    '}',
    '',
    'Field Directives (Co-located):',
    '- "definition" (一句话定位 · ≤40 chars):',
    '  Identify the technical archetype and primitive. State stack and mechanics directly. Finish as a noun phrase.',
    '',
    '- "painPoint" (核心痛点 · ≤60 chars):',
    '  Identify the concrete friction or mechanical bottleneck in traditional/native approaches. Specify the failing mechanism.',
    '',
    '- "scenarios" (适用场景 · ≤60 chars):',
    '  Identify the exact architectural niche or caller component.',
    '',
    'Language:',
    isZh
      ? 'Write in Simplified Chinese (zh-CN). Apply a single half-width space between Chinese characters and Latin terms/numbers.'
      : 'Write in English (en).',
  ].join('\n');

  const cleanedReadme = cleanReadmeForDigest(readme);

  const userLines = [
    `Target Language: ${targetLocale}`,
    '',
    'Repository Metadata:',
    `- Name: ${fullName}`,
    `- Description: ${description?.trim() || '(None)'}`,
    `- Language: ${language?.trim() || '(Unspecified)'}`,
    `- Topics: ${topics.length > 0 ? topics.join(', ') : '(None)'}`,
  ];

  if (cleanedReadme) {
    userLines.push('', 'README Excerpt:', '"""', cleanedReadme, '"""');
  }

  return {
    system,
    user: userLines.join('\n'),
  };
}

/**
 * 健壮解析 LLM 返回的 JSON 字符串。
 * 兼容 markdown 代码块包裹、松散空白与前后说明文字。
 */
export function parseRepoDigest(raw: string | null | undefined): RepoDigestData | null {
  if (!raw || typeof raw !== 'string') return null;

  let trimmed = raw.trim();
  const jsonBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch?.[1]) {
    trimmed = jsonBlockMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }
  const jsonSubstring = trimmed.slice(firstBrace, lastBrace + 1);

  try {
    const parsed = JSON.parse(jsonSubstring) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;

    const record = parsed as Record<string, unknown>;
    const definition = typeof record.definition === 'string' ? record.definition.trim() : '';
    const painPoint = typeof record.painPoint === 'string' ? record.painPoint.trim() : '';
    const scenarios = typeof record.scenarios === 'string' ? record.scenarios.trim() : '';

    if (!definition || !painPoint || !scenarios) {
      return null;
    }

    return {
      definition,
      painPoint,
      scenarios,
    };
  } catch {
    return null;
  }
}
