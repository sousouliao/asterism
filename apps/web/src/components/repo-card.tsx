import type { MatchExplanation } from '@asterism/core';
import type { StarredRepoRecord } from '@asterism/db';
import { Badge, Card, cn, Tooltip, TooltipContent, TooltipTrigger } from '@asterism/ui';
import { ArchiveIcon, CheckIcon, GitForkIcon, NotebookPenIcon, StarIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { BulkSelectionController } from '../lib/bulk-selection';
import { formatCompactNumber, formatCompactRelativeTime, formatRelativeTime } from '../lib/format';
import { languageColor } from '../lib/language-colors';
import type { RepoOpenModality } from '../stores/repo-inspector';
import { MatchExplanationBadge } from './match-explanation-badge';
import { OverflowChipRow } from './overflow-chip-row';
import {
  buildRepoContextItems,
  type RepoCardCollection,
  type RepoContextItem,
} from './repo-card-context';
import { TruncatedDescription } from './truncated-description';

function StatusIndicator({
  label,
  onSelect,
  interactive = true,
  children,
}: {
  label: string;
  onSelect?: () => void;
  interactive?: boolean;
  children: ReactNode;
}) {
  const className = cn(
    'inline-flex h-6 items-center gap-1 rounded-sm px-1 text-caption text-muted-foreground transition-colors duration-150 [transition-timing-function:var(--ease-out-quart)] hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    interactive && 'pointer-events-auto',
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {onSelect ? (
          <button type="button" aria-label={label} onClick={onSelect} className={className}>
            {children}
          </button>
        ) : (
          <span role="img" aria-label={label} className={className}>
            {children}
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent sideOffset={6}>{label}</TooltipContent>
    </Tooltip>
  );
}

function ContextChip({ item }: { item: RepoContextItem }) {
  return (
    <Badge variant="secondary" className="h-[22px] font-normal">
      {item.label}
    </Badge>
  );
}

export const RepoCard = memo(function RepoCard({
  record,
  collections,
  explanation,
  hasNote = false,
  selected = false,
  onSelect,
  bulkSelection,
  className,
}: {
  record: StarredRepoRecord;
  collections?: RepoCardCollection[];
  explanation?: MatchExplanation;
  hasNote?: boolean;
  selected?: boolean;
  onSelect?: (record: StarredRepoRecord, modality: RepoOpenModality) => void;
  bulkSelection?: BulkSelectionController;
  className?: string;
}) {
  const { repo, starredAt } = record;
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const updated = formatRelativeTime(repo.pushedAt, locale);
  const compactUpdated = formatCompactRelativeTime(repo.pushedAt, locale);
  const starred = formatRelativeTime(starredAt, locale);
  const compactStarred = formatCompactRelativeTime(starredAt, locale);
  const dotColor = languageColor(repo.language);
  const contextItems = useMemo(
    () => buildRepoContextItems(collections ?? [], repo.topics),
    [collections, repo.topics],
  );
  const handleOpen = onSelect ? () => onSelect(record, 'pointer') : undefined;
  const bulkSelected = bulkSelection?.repoIds.has(record.repoId) ?? false;
  const noteLabel = t('browse.hasNote');

  return (
    <Card
      data-selected={selected || bulkSelected}
      className={cn(
        'group relative flex h-auto min-h-[208px] flex-col gap-3 rounded-lg p-4 transition-[border-color,background-color,box-shadow,filter] duration-150 [transition-timing-function:var(--ease-out-quart)] hover:border-ring/50 hover:shadow-[0_2px_6px_rgba(22,26,34,0.08)] active:brightness-[0.98] sm:h-[208px] dark:hover:shadow-none',
        (selected || bulkSelected) &&
          'border-ring/70 bg-accent/25 shadow-[inset_0_0_0_1px_var(--ring)]',
        className,
      )}
    >
      {handleOpen || bulkSelection ? (
        <button
          type="button"
          aria-label={
            bulkSelection
              ? t(bulkSelected ? 'bulk.deselectRepo' : 'bulk.selectRepo', { repo: repo.fullName })
              : t('browse.openDetails', { repo: repo.fullName })
          }
          aria-pressed={bulkSelection ? bulkSelected : undefined}
          aria-expanded={bulkSelection ? undefined : selected}
          aria-controls={bulkSelection ? undefined : 'repo-inspector'}
          data-repo-quick-look-trigger={bulkSelection ? undefined : record.repoId}
          onClick={(event) =>
            bulkSelection
              ? bulkSelection.onToggle(record.repoId)
              : onSelect?.(record, event.detail === 0 ? 'keyboard' : 'pointer')
          }
          className="absolute inset-0 z-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        />
      ) : null}

      {bulkSelection ? (
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute top-4 left-4 z-20 flex size-5 items-center justify-center rounded-sm border bg-card',
            bulkSelected && 'border-primary bg-primary text-primary-foreground',
          )}
        >
          {bulkSelected ? <CheckIcon className="size-3.5" /> : null}
        </span>
      ) : null}

      <div
        className={cn(
          'relative z-10 flex min-h-0 flex-1 flex-col gap-3',
          (handleOpen || bulkSelection) && 'pointer-events-none',
          bulkSelection && 'pl-7',
        )}
      >
        <div className="flex h-5 min-w-0 items-start justify-between gap-2">
          {bulkSelection ? (
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
            </span>
          ) : (
            <a
              href={`https://github.com/${repo.fullName}`}
              target="_blank"
              rel="noreferrer noopener"
              className="group/link pointer-events-auto flex min-w-0 items-center gap-2 rounded-sm text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                aria-hidden="true"
                className={cn('size-2.5 shrink-0 rounded-full', !dotColor && 'bg-muted-foreground')}
                style={dotColor ? { backgroundColor: dotColor } : undefined}
              />
              <span className="min-w-0 truncate">
                <span className="font-medium text-muted-foreground">{repo.owner}</span>
                <span className="text-muted-foreground"> / </span>
                <span className="font-semibold text-link group-hover/link:underline">
                  {repo.name}
                </span>
              </span>
            </a>
          )}
          {repo.archived ? (
            <Badge variant="outline" className="h-5 shrink-0 gap-1 text-muted-foreground">
              <ArchiveIcon className="size-3" aria-hidden="true" />
              {t('browse.archived')}
            </Badge>
          ) : null}
          {record.unstarredAt ? (
            <Badge variant="outline" className="h-5 shrink-0 text-muted-foreground">
              {t('browse.unstarred')}
            </Badge>
          ) : null}
        </div>

        <div className="min-h-10">
          {repo.description ? (
            <TruncatedDescription
              onSelect={bulkSelection ? () => bulkSelection.onToggle(record.repoId) : handleOpen}
            >
              {repo.description}
            </TruncatedDescription>
          ) : null}
        </div>

        {explanation && !bulkSelection ? (
          <div className="flex min-w-0 items-center pointer-events-auto">
            <MatchExplanationBadge explanation={explanation} />
          </div>
        ) : null}

        <div className="flex min-h-6 min-w-0 items-center gap-2">
          <div className="min-w-0 flex-1">
            {contextItems.length > 0 ? (
              <OverflowChipRow
                items={contextItems}
                getKey={(item) => item.key}
                getItemLabel={(item) => item.label}
                overflowLabel={(count) => t('browse.moreContextLabel', { count })}
                renderChip={(item) => <ContextChip item={item} />}
                renderOverflowChip={(count) => (
                  <Badge variant="secondary" className="h-[22px] font-normal text-muted-foreground">
                    +{count}
                  </Badge>
                )}
                renderTooltipItem={(item) => <ContextChip item={item} />}
                className={bulkSelection ? undefined : 'pointer-events-auto'}
              />
            ) : null}
          </div>
          <span className="flex shrink-0 items-center gap-1">
            {hasNote ? (
              <StatusIndicator
                label={noteLabel}
                onSelect={bulkSelection ? undefined : handleOpen}
                interactive={!bulkSelection}
              >
                <NotebookPenIcon className="size-3.5" aria-hidden="true" />
              </StatusIndicator>
            ) : null}
          </span>
        </div>

        <div className="mt-auto flex min-w-0 flex-col items-start gap-1 text-caption text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <span className="flex shrink-0 items-center gap-3">
            <span className="flex items-center gap-1" title={t('browse.stars')}>
              <StarIcon className="size-3.5" aria-hidden="true" />
              {formatCompactNumber(repo.stargazers, locale)}
            </span>
            {repo.forks != null ? (
              <span className="flex items-center gap-1" title={t('browse.forks')}>
                <GitForkIcon className="size-3.5" aria-hidden="true" />
                {formatCompactNumber(repo.forks, locale)}
              </span>
            ) : null}
          </span>
          <span className="flex min-w-0 items-center gap-2 whitespace-nowrap sm:justify-end">
            {updated && compactUpdated ? (
              <span title={t('browse.updated', { time: updated })}>
                <span aria-hidden="true">
                  {t('browse.updatedCompact', { time: compactUpdated })}
                </span>
                <span className="sr-only">{t('browse.updated', { time: updated })}</span>
              </span>
            ) : null}
            {updated && compactUpdated && starred && compactStarred ? (
              <span aria-hidden="true">·</span>
            ) : null}
            {starred && compactStarred ? (
              <span title={t('browse.starred', { time: starred })}>
                <span aria-hidden="true">
                  {t('browse.starredCompact', { time: compactStarred })}
                </span>
                <span className="sr-only">{t('browse.starred', { time: starred })}</span>
              </span>
            ) : null}
          </span>
        </div>
      </div>
    </Card>
  );
});
