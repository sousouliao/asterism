/**
 * Ask 流式正文与推荐哨兵块的切分。流中与流末共用，避免两套解析。
 *
 * 哨兵必须独占一行：
 * ```asterism-recommendations
 * [0, 2]
 * ```
 */

export const ASK_RECOMMENDATIONS_FENCE = 'asterism-recommendations';

const OPEN_MARKER = `\`\`\`${ASK_RECOMMENDATIONS_FENCE}`;

export interface AskStreamSplit {
  /** 可供渲染的 Markdown 正文（不含哨兵及其未完成前缀）。 */
  body: string;
  /** 围栏体原文；流中途未闭合时为 null。 */
  recommendations: string | null;
}

function stripTrailingNewlines(value: string): string {
  return value.replace(/(?:\r?\n)+$/u, '');
}

function findOpenIndex(raw: string): number {
  if (raw.startsWith(OPEN_MARKER)) {
    return 0;
  }
  const needle = `\n${OPEN_MARKER}`;
  const index = raw.lastIndexOf(needle);
  return index === -1 ? -1 : index + 1;
}

/**
 * 流中途出现 ` ```asterism-… ` 前缀时立刻从正文裁掉，避免哨兵语言名闪现。
 * 至少要看到 ` ```a ` 才动手，以免误伤普通代码围栏的闭合反引号。
 */
function stripPartialOpen(raw: string): string {
  const max = OPEN_MARKER.length + 1;
  for (let length = Math.min(raw.length, max); length >= 4; length -= 1) {
    const tail = raw.slice(-length);
    const atLineStart = tail.startsWith('\n') || raw.length === length;
    if (!atLineStart) {
      continue;
    }
    const marker = tail.startsWith('\n') ? tail.slice(1) : tail;
    if (marker.startsWith('```') && OPEN_MARKER.startsWith(marker) && marker.length >= 4) {
      return raw.slice(0, -length);
    }
  }
  return raw;
}

/**
 * 切开正文与末尾推荐围栏。未闭合的哨兵视为尚未完成，不进入 body。
 */
export function splitAskStream(raw: string): AskStreamSplit {
  const openIndex = findOpenIndex(raw);
  if (openIndex === -1) {
    return { body: stripPartialOpen(raw), recommendations: null };
  }

  const afterOpen = raw.slice(openIndex + OPEN_MARKER.length);
  const innerStart = afterOpen.replace(/^[ \t]*\r?\n/u, '');
  const close = innerStart.match(/\r?\n```[ \t]*(?:\r?\n|$)/u);
  if (close?.index !== undefined) {
    const afterClose = innerStart.slice(close.index + close[0].length);
    if (afterClose.trim().length === 0) {
      return {
        body: stripTrailingNewlines(raw.slice(0, openIndex)),
        recommendations: innerStart.slice(0, close.index).trim(),
      };
    }
  }

  return {
    body: stripTrailingNewlines(raw.slice(0, openIndex)),
    recommendations: null,
  };
}
