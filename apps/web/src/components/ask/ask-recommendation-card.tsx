import type { AskCandidate, MatchReason } from '@asterism/core';
import type { StarredRepoRecord } from '@asterism/db';
import { Badge, cn } from '@asterism/ui';
import { ArchiveIcon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { languageColor } from '../../lib/language-colors';
import type { RepoOpenModality } from '../../stores/repo-inspector';
import { MatchExplanationBadge } from '../match-explanation-badge';

export interface AskRecommendationCardProps {
  candidate: AskCandidate<StarredRepoRecord>;
  selected?: boolean;
  onSelect: (record: StarredRepoRecord, modality: RepoOpenModality) => void;
}

/**
 * Ask 回答中的推荐条目：整行可点开 Repo Quick Look；证据标签来自本地召回理由
 * （MatchExplanation），模型无法引入候选之外的仓库（ADR 0042 结构保证）。
 */
export const AskRecommendationCard = memo(function AskRecommendationCard({
  candidate,
  selected = false,
  onSelect,
}: AskRecommendationCardProps) {
  const { t } = useTranslation();
  const { repo } = candidate.item;
  const dotColor = languageColor(repo.language);

  return (
    <li
      data-selected={selected || undefined}
      className={cn(
        'group relative rounded-md border bg-background/60 transition-[border-color,background-color] duration-150 [transition-timing-function:var(--ease-out-quart)] hover:border-ring/50',
        selected && 'border-ring/70 bg-accent/25 shadow-[inset_0_0_0_1px_var(--ring)]',
      )}
    >
      <button
        type="button"
        className="flex w-full flex-col gap-2 rounded-md p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        onClick={(event) => onSelect(candidate.item, event.detail === 0 ? 'keyboard' : 'pointer')}
      >
        <span className="flex min-w-0 items-center gap-2 text-body">
          <span
            aria-hidden="true"
            className={cn('size-2.5 shrink-0 rounded-full', !dotColor && 'bg-muted-foreground')}
            style={dotColor ? { backgroundColor: dotColor } : undefined}
          />
          <span className="min-w-0 truncate">
            <span className="font-medium text-muted-foreground">{repo.owner}</span>
            <span className="text-muted-foreground"> / </span>
            <span className="font-semibold text-foreground group-hover:text-link">{repo.name}</span>
          </span>
          {repo.archived ? (
            <Badge variant="outline" className="h-5 shrink-0 gap-1 text-muted-foreground">
              <ArchiveIcon className="size-3" aria-hidden="true" />
              {t('browse.archived')}
            </Badge>
          ) : null}
        </span>
        {repo.description ? (
          <span className="line-clamp-2 text-caption text-muted-foreground">
            {repo.description}
          </span>
        ) : null}
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          {candidate.reasons.length > 0 ? (
            <MatchExplanationBadge
              explanation={{
                repoId: candidate.repoId,
                reasons: candidate.reasons,
                primaryReason: candidate.reasons[0] as MatchReason,
              }}
            />
          ) : null}
          <span className="ml-auto shrink-0 text-micro text-muted-foreground tabular-nums">
            {repo.stargazers.toLocaleString()} ★
          </span>
        </span>
      </button>
    </li>
  );
});
