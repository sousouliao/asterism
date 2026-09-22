import type { Memory, ResurfaceCandidate } from '@asterism/core';
import type { StarredRepoRecord } from '@asterism/db';
import { Badge, Button, Card, cn, Tooltip, TooltipContent, TooltipTrigger } from '@asterism/ui';
import { ArchiveIcon, PenLineIcon, ThumbsUpIcon, XIcon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatCompactRelativeTime, formatRelativeTime } from '../../lib/format';
import { languageColor } from '../../lib/language-colors';
import type { ResurfaceFeedbackAction } from '../../lib/resurface-feedback';
import type { RepoOpenModality } from '../../stores/repo-inspector';
import { ResurfaceReasonItem } from './resurface-reason';

export interface ResurfaceCardProps {
  candidate: ResurfaceCandidate<StarredRepoRecord>;
  memory?: Memory;
  selected?: boolean;
  onSelect: (record: StarredRepoRecord, modality: RepoOpenModality) => void;
  /** 省略表示反馈无法持久化（无会话）：此时不渲染反馈控件，而非渲染一个静默无效的按钮。 */
  onFeedback?: (repoId: string, action: ResurfaceFeedbackAction) => void;
}

export const ResurfaceCard = memo(function ResurfaceCard({
  candidate,
  memory,
  selected = false,
  onSelect,
  onFeedback,
}: ResurfaceCardProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const record = candidate.item;
  const { repo, starredAt } = record;
  const starred = formatRelativeTime(starredAt, locale);
  const compactStarred = formatCompactRelativeTime(starredAt, locale);
  const dotColor = languageColor(repo.language);
  const echo = memory?.whySaved?.trim() || memory?.note?.trim() || null;
  const echoLabel = memory?.whySaved?.trim()
    ? t('dashboard.resurface.echoWhySaved')
    : t('dashboard.resurface.echoNote');
  const showAddIntent = candidate.stream === 'missing_context';
  const dismissLabel = t('dashboard.resurface.dismiss');

  return (
    <Card
      data-selected={selected || undefined}
      className={cn(
        'group relative gap-3 rounded-lg p-4 transition-[border-color,background-color,box-shadow,filter] duration-150 [transition-timing-function:var(--ease-out-quart)] hover:border-ring/50 hover:shadow-[0_2px_6px_rgba(22,26,34,0.08)] active:brightness-[0.98] dark:hover:shadow-none',
        selected && 'border-ring/70 bg-accent/25 shadow-[inset_0_0_0_1px_var(--ring)]',
      )}
    >
      <button
        type="button"
        aria-label={t('browse.openDetails', { repo: repo.fullName })}
        aria-expanded={selected}
        aria-controls="repo-inspector"
        onClick={(event) => onSelect(record, event.detail === 0 ? 'keyboard' : 'pointer')}
        className="absolute inset-0 z-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-3 pointer-events-none">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2 text-body">
            <span
              aria-hidden="true"
              className={cn('size-2.5 shrink-0 rounded-full', !dotColor && 'bg-muted-foreground')}
              style={dotColor ? { backgroundColor: dotColor } : undefined}
            />
            <span className="min-w-0 truncate">
              <span className="font-medium text-muted-foreground">{repo.owner}</span>
              <span className="text-muted-foreground"> / </span>
              <a
                href={`https://github.com/${repo.fullName}`}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={t('browse.openOnGitHub', { repo: repo.fullName })}
                className="pointer-events-auto rounded-sm font-semibold text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {repo.name}
              </a>
            </span>
            {repo.archived ? (
              <Badge variant="outline" className="h-5 shrink-0 gap-1 text-muted-foreground">
                <ArchiveIcon className="size-3" aria-hidden="true" />
                {t('browse.archived')}
              </Badge>
            ) : null}
          </span>
          {starred && compactStarred ? (
            <span
              className="shrink-0 text-caption leading-5 text-muted-foreground tabular-nums"
              title={t('browse.starred', { time: starred })}
            >
              <span aria-hidden="true">{t('browse.starredCompact', { time: compactStarred })}</span>
              <span className="sr-only">{t('browse.starred', { time: starred })}</span>
            </span>
          ) : null}
        </div>

        <ul className="flex min-w-0 flex-wrap gap-1.5">
          {candidate.reasons.map((reason) => (
            <ResurfaceReasonItem key={reason.kind} reason={reason} t={t} locale={locale} />
          ))}
        </ul>

        {candidate.stream === 'worth_remembering' && echo ? (
          <p className="min-w-0 truncate text-caption" title={echo}>
            <span className="font-medium text-foreground/80">{echoLabel}</span>
            <span className="text-muted-foreground"> · {echo}</span>
          </p>
        ) : null}

        <div className="pointer-events-auto mt-auto flex min-w-0 flex-wrap items-center justify-between gap-2">
          {showAddIntent ? (
            <Button
              type="button"
              variant="secondary"
              size="xs"
              onClick={() => onSelect(record, 'pointer')}
            >
              <PenLineIcon className="size-3.5" aria-hidden="true" />
              {t('dashboard.resurface.addWhySaved')}
            </Button>
          ) : null}
          {onFeedback ? (
            <div className="ml-auto flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => onFeedback(candidate.repoId, 'useful')}
              >
                <ThumbsUpIcon className="size-3.5" aria-hidden="true" />
                {t('dashboard.resurface.useful')}
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={dismissLabel}
                    onClick={() => onFeedback(candidate.repoId, 'dismissed')}
                  >
                    <XIcon className="size-4" aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>{dismissLabel}</TooltipContent>
              </Tooltip>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
});
