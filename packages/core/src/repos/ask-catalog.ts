import type { StarredRepoLike } from './filter';

/** 完整行目录的仓库数上限（含截断描述）。 */
export const ASK_CATALOG_FULL_MAX = 800;
/** 精简行目录的仓库数上限；超过则改为分组目录。 */
export const ASK_CATALOG_COMPACT_MAX = 2500;
/** 完整行描述截断长度。 */
export const ASK_CATALOG_DESCRIPTION_CHARS = 80;
/** 分组目录每个 (语言, topic) 展示的代表仓库数。 */
const GROUP_SAMPLE = 6;

export type AskCatalogTier = 'full' | 'compact' | 'grouped';

export interface BuildAskCatalogInput<T extends StarredRepoLike> {
  items: readonly T[];
}

export interface AskCatalog {
  tier: AskCatalogTier;
  text: string;
  estimatedTokens: number;
  repoIds: string[];
}

export function classifyAskCatalogTier(count: number): AskCatalogTier {
  if (count <= ASK_CATALOG_FULL_MAX) {
    return 'full';
  }
  if (count <= ASK_CATALOG_COMPACT_MAX) {
    return 'compact';
  }
  return 'grouped';
}

/** 粗估：约 4 字符 ≈ 1 token，用于档位决策与预算，不是计费依据。 */
export function estimateAskTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function catalogItems<T extends StarredRepoLike>(items: readonly T[]): (T & { repoId: string })[] {
  return items
    .filter((item): item is T & { repoId: string } => Boolean(item.repoId))
    .toSorted(
      (left, right) =>
        right.repo.stargazers - left.repo.stargazers ||
        left.repo.fullName.localeCompare(right.repo.fullName) ||
        left.repoId.localeCompare(right.repoId),
    );
}

function truncateDescription(value: string | null): string {
  const text = value?.trim() ?? '';
  if (text.length === 0) {
    return '';
  }
  return text.length <= ASK_CATALOG_DESCRIPTION_CHARS
    ? text
    : `${text.slice(0, ASK_CATALOG_DESCRIPTION_CHARS - 1)}…`;
}

function formatTopics(topics: readonly string[]): string {
  return topics.length > 0 ? topics.join(',') : '-';
}

function formatFullLine<T extends StarredRepoLike>(item: T & { repoId: string }): string {
  const description = truncateDescription(item.repo.description);
  const base = `${item.repoId} | ${item.repo.fullName} | ${item.repo.language ?? '-'} | ${formatTopics(item.repo.topics)}${item.unstarredAt ? ' | no longer starred' : ''}`;
  return description ? `${base} | ${description}` : base;
}

function formatCompactLine<T extends StarredRepoLike>(item: T & { repoId: string }): string {
  return `${item.repoId} | ${item.repo.fullName} | ${item.repo.language ?? '-'} | ${formatTopics(item.repo.topics)}${item.unstarredAt ? ' | no longer starred' : ''}`;
}

function formatGroupedCatalog<T extends StarredRepoLike>(
  items: readonly (T & { repoId: string })[],
): string {
  const byLanguage = new Map<string, (T & { repoId: string })[]>();
  for (const item of items) {
    const language = item.repo.language?.trim() || '(no language)';
    const bucket = byLanguage.get(language);
    if (bucket) {
      bucket.push(item);
    } else {
      byLanguage.set(language, [item]);
    }
  }

  const languages = [...byLanguage.entries()].toSorted(
    (left, right) => right[1].length - left[1].length || left[0].localeCompare(right[0]),
  );

  const sections = languages.map(([language, members]) => {
    const byTopic = new Map<string, (T & { repoId: string })[]>();
    for (const item of members) {
      const topics = item.repo.topics.length > 0 ? item.repo.topics : ['other'];
      for (const topic of topics) {
        const bucket = byTopic.get(topic);
        if (bucket) {
          bucket.push(item);
        } else {
          byTopic.set(topic, [item]);
        }
      }
    }
    const topicLines = [...byTopic.entries()]
      .toSorted(
        (left, right) => right[1].length - left[1].length || left[0].localeCompare(right[0]),
      )
      .map(([topic, topicItems]) => {
        const unique = [...new Map(topicItems.map((entry) => [entry.repoId, entry])).values()];
        const names = unique
          .slice(0, GROUP_SAMPLE)
          .map((entry) => entry.repo.name)
          .join(', ');
        const more = unique.length > GROUP_SAMPLE ? ` +${unique.length - GROUP_SAMPLE}` : '';
        return `  ${topic}(${names}${more})`;
      });
    return `${language} (${members.length})\n${topicLines.join('\n')}`;
  });

  return [`Collection catalog (grouped, ${items.length} repositories):`, ...sections].join('\n');
}

/**
 * 按库规模生成稳定目录文本。排序确定：star 数 → fullName → repoId。
 * 同一批仓库每次输出逐字相同，供 Provider 前缀缓存。
 */
export function buildAskCatalog<T extends StarredRepoLike>({
  items,
}: BuildAskCatalogInput<T>): AskCatalog {
  const ranked = catalogItems(items);
  const repoIds = ranked.map((item) => item.repoId);
  const tier = classifyAskCatalogTier(ranked.length);

  let text: string;
  if (tier === 'full') {
    text = [
      `Collection catalog (full, ${ranked.length} repositories):`,
      ...ranked.map((item) => formatFullLine(item)),
    ].join('\n');
  } else if (tier === 'compact') {
    text = [
      `Collection catalog (compact, ${ranked.length} repositories):`,
      ...ranked.map((item) => formatCompactLine(item)),
    ].join('\n');
  } else {
    text = formatGroupedCatalog(ranked);
  }

  return { tier, text, estimatedTokens: estimateAskTokens(text), repoIds };
}
