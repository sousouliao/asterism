import type { MatchExplanation } from '@asterism/core';
import type { StarredRepoRecord } from '@asterism/db';
import { Badge, cn } from '@asterism/ui';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArchiveIcon, CheckIcon, NotebookPenIcon, StarIcon } from 'lucide-react';
import { type KeyboardEvent, type MouseEvent, memo, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BulkSelectionController } from '../lib/bulk-selection';
import { formatCompactNumber, formatCompactRelativeTime, formatRelativeTime } from '../lib/format';
import { languageColor } from '../lib/language-colors';
import { findScrollParent, useScrollMargin } from '../lib/scroll-margin';
import type { RepoOpenModality } from '../stores/repo-inspector';
import { MatchExplanationBadge } from './match-explanation-badge';
import { OverflowChipRow } from './overflow-chip-row';
import {
  buildRepoContextItems,
  type RepoCardCollection,
  type RepoContextItem,
} from './repo-card-context';
import { SemanticSectionLabel } from './semantic-section-separator';

const DESKTOP_ROW_HEIGHT = 64;
const MOBILE_ROW_HEIGHT = 104;
/** 静态（非虚拟化）语义近邻行不参与虚拟测量。 */
const NOOP_MEASURE_ELEMENT = () => {};
type TableLayout = 'mobile' | 'compact' | 'wide';

function tableGridClass(layout: TableLayout): string {
  if (layout === 'mobile') {
    return 'grid grid-cols-[auto_auto_minmax(0,1fr)]';
  }
  if (layout === 'compact') {
    return 'grid grid-cols-[minmax(0,1fr)_5rem_8rem]';
  }
  return 'grid grid-cols-[minmax(0,1fr)_9rem_5rem_8rem]';
}

function useTableLayout(ref: React.RefObject<HTMLElement | null>): TableLayout {
  const [layout, setLayout] = useState<TableLayout>('mobile');

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const update = () => {
      const width = element.clientWidth;
      setLayout(width < 640 ? 'mobile' : width < 1024 ? 'compact' : 'wide');
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return layout;
}

function ActivityValue({
  compact,
  full,
  shortLabel,
  fullLabel,
}: {
  compact: string | null;
  full: string | null;
  shortLabel: string;
  fullLabel: (time: string) => string;
}) {
  if (!compact || !full) {
    return null;
  }

  return (
    <span title={fullLabel(full)}>
      <span aria-hidden="true">
        {shortLabel} <span className="font-mono tabular-nums">{compact}</span>
      </span>
      <span className="sr-only">{fullLabel(full)}</span>
    </span>
  );
}

function ContextChip({ item }: { item: RepoContextItem }) {
  return (
    <Badge variant="secondary" className="h-[22px] font-normal">
      {item.label}
    </Badge>
  );
}

function RepoContext({
  collections,
  topics,
  hasNote,
}: {
  collections: readonly RepoCardCollection[];
  topics: readonly string[];
  hasNote: boolean;
}) {
  const { t } = useTranslation();
  const contextItems = buildRepoContextItems(collections, topics);
  const hasContext = contextItems.length > 0 || hasNote;

  if (!hasContext) {
    return null;
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
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
          />
        ) : null}
      </div>
      <span className="flex shrink-0 items-center gap-2 text-caption text-muted-foreground">
        {hasNote ? (
          <span role="img" aria-label={t('browse.hasNote')} title={t('browse.hasNote')}>
            <NotebookPenIcon className="size-3.5" aria-hidden="true" />
          </span>
        ) : null}
      </span>
    </div>
  );
}

export const RepoTableRow = memo(function RepoTableRow({
  record,
  collections = [],
  explanation,
  hasNote = false,
  onSelect,
  selected = false,
  layout,
  rowIndex,
  measureElement,
  bulkSelection,
  className,
}: {
  record: StarredRepoRecord;
  collections?: RepoCardCollection[];
  explanation?: MatchExplanation;
  hasNote?: boolean;
  onSelect?: (record: StarredRepoRecord, modality: RepoOpenModality) => void;
  selected?: boolean;
  layout: TableLayout;
  rowIndex: number;
  measureElement: (element: HTMLTableRowElement | null) => void;
  bulkSelection?: BulkSelectionController;
  className?: string;
}) {
  const { repo, starredAt } = record;
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const dotColor = languageColor(repo.language);
  const updated = formatRelativeTime(repo.pushedAt, locale);
  const compactUpdated = formatCompactRelativeTime(repo.pushedAt, locale);
  const starred = formatRelativeTime(starredAt, locale);
  const compactStarred = formatCompactRelativeTime(starredAt, locale);
  const handleOpen = onSelect
    ? (modality: RepoOpenModality) => onSelect(record, modality)
    : undefined;
  const bulkSelected = bulkSelection?.repoIds.has(record.repoId) ?? false;
  const handleRowClick = bulkSelection
    ? (event: MouseEvent<HTMLTableRowElement>) => {
        const target = event.target as Element;
        if (target.closest('a, button, [role="button"]')) return;
        bulkSelection.onToggle(record.repoId);
      }
    : handleOpen
      ? (event: MouseEvent<HTMLTableRowElement>) => {
          const target = event.target as Element;
          if (target.closest('a, button, [role="button"]')) {
            return;
          }
          handleOpen('pointer');
        }
      : undefined;
  const handleRowKeyDown = bulkSelection
    ? (event: KeyboardEvent<HTMLTableRowElement>) => {
        if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' '))
          return;
        event.preventDefault();
        bulkSelection.onToggle(record.repoId);
      }
    : handleOpen
      ? (event: KeyboardEvent<HTMLTableRowElement>) => {
          if (
            event.target !== event.currentTarget ||
            (event.key !== 'Enter' && event.key !== ' ')
          ) {
            return;
          }
          event.preventDefault();
          handleOpen('keyboard');
        }
      : undefined;

  return (
    <tr
      ref={measureElement}
      data-index={rowIndex - 2}
      aria-rowindex={rowIndex}
      aria-label={
        bulkSelection
          ? t(bulkSelected ? 'bulk.deselectRepo' : 'bulk.selectRepo', { repo: repo.fullName })
          : handleOpen
            ? t('browse.openDetails', { repo: repo.fullName })
            : undefined
      }
      aria-selected={bulkSelection ? bulkSelected : selected}
      aria-expanded={bulkSelection ? undefined : selected}
      aria-controls={!bulkSelection && handleOpen ? 'repo-inspector' : undefined}
      data-repo-quick-look-trigger={!bulkSelection && handleOpen ? record.repoId : undefined}
      tabIndex={bulkSelection || handleOpen ? 0 : undefined}
      onClick={handleRowClick}
      onKeyDown={handleRowKeyDown}
      className={cn(
        tableGridClass(layout),
        layout === 'mobile'
          ? 'min-h-[104px] gap-x-3 gap-y-2 px-3 py-3'
          : 'h-16 min-h-16 gap-0 px-0 py-0',
        'group relative border-border/50 border-b transition-colors hover:bg-accent/20 focus-visible:bg-accent/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        bulkSelected && 'bg-accent/30',
        !bulkSelection && selected && 'bg-accent/30 shadow-[inset_0_0_0_1px_var(--ring)]',
        (handleOpen || bulkSelection) && 'cursor-pointer',
        className,
      )}
    >
      {bulkSelection ? (
        <td
          aria-hidden="true"
          className="absolute top-1/2 left-3 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm border bg-card data-[selected=true]:border-primary data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
          data-selected={bulkSelected}
        >
          {bulkSelected ? <CheckIcon className="size-3.5" /> : null}
        </td>
      ) : null}
      <td
        className={cn(
          'flex min-w-0 flex-col justify-center gap-1',
          layout === 'mobile' ? 'col-span-3' : 'col-span-1 px-3',
          bulkSelection ? 'pl-11' : undefined,
        )}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          {bulkSelection ? (
            <span className="min-w-0 truncate text-caption">
              <span className="font-normal text-muted-foreground">{repo.owner}</span>
              <span className="text-muted-foreground"> / </span>
              <span className="font-semibold text-body text-link">{repo.name}</span>
            </span>
          ) : (
            <a
              href={`https://github.com/${repo.fullName}`}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={t('browse.openOnGitHub', { repo: repo.fullName })}
              className="group/link min-w-0 truncate rounded-sm text-caption focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="font-normal text-muted-foreground">{repo.owner}</span>
              <span className="text-muted-foreground"> / </span>
              <span className="font-semibold text-body text-link group-hover/link:underline">
                {repo.name}
              </span>
            </a>
          )}
          {repo.archived ? (
            <Badge
              variant="outline"
              className="h-5 shrink-0 gap-1 px-1.5 text-micro text-muted-foreground"
            >
              <ArchiveIcon className="size-3" aria-hidden="true" />
              {t('browse.archived')}
            </Badge>
          ) : null}
          {explanation && !bulkSelection ? (
            <MatchExplanationBadge
              explanation={explanation}
              showSnippet={false}
              className="shrink-0"
            />
          ) : null}
        </div>
        <div className="flex min-w-0 items-center gap-3">
          {repo.description ? (
            <p className="min-w-0 flex-1 truncate text-caption text-muted-foreground">
              {repo.description}
            </p>
          ) : null}
          <div
            className={cn('min-w-0 max-w-[45%] flex-[0_1_18rem]', layout === 'mobile' && 'hidden')}
          >
            <RepoContext collections={collections} topics={repo.topics} hasNote={hasNote} />
          </div>
        </div>
        <div className={cn('mt-1 min-w-0', layout !== 'mobile' && 'hidden')}>
          <RepoContext collections={collections} topics={repo.topics} hasNote={hasNote} />
        </div>
      </td>

      <td
        className={cn(
          'flex min-w-0 items-center text-caption text-foreground',
          layout === 'wide' && 'px-3',
          layout === 'compact' &&
            'absolute h-px w-px overflow-hidden whitespace-nowrap [clip-path:inset(50%)]',
        )}
      >
        {repo.language ? (
          <span className="flex min-w-0 items-center gap-1.5">
            <span
              aria-hidden="true"
              className={cn('size-2.5 shrink-0 rounded-full', !dotColor && 'bg-muted-foreground')}
              style={dotColor ? { backgroundColor: dotColor } : undefined}
            />
            <span className="truncate">{repo.language}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>

      <td
        className={cn(
          'flex items-center gap-1 self-center font-mono text-caption text-foreground',
          layout !== 'mobile' && 'px-3',
        )}
      >
        <StarIcon className={cn('size-3.5', layout !== 'mobile' && 'hidden')} aria-hidden="true" />
        {formatCompactNumber(repo.stargazers, locale)}
      </td>

      <td
        className={cn(
          'flex min-w-0 flex-col justify-center gap-y-1 self-center whitespace-nowrap text-micro text-muted-foreground',
          layout === 'mobile' ? 'items-end' : 'items-start px-3',
        )}
      >
        <ActivityValue
          compact={compactUpdated}
          full={updated}
          shortLabel={t('browse.updatedShort')}
          fullLabel={(time) => t('browse.updated', { time })}
        />
        <ActivityValue
          compact={compactStarred}
          full={starred}
          shortLabel={t('browse.starredShort')}
          fullLabel={(time) => t('browse.starred', { time })}
        />
        {!compactUpdated && !compactStarred ? <span>—</span> : null}
      </td>
    </tr>
  );
});

function TableHeader({ layout }: { layout: TableLayout }) {
  const { t } = useTranslation();
  const className = 'px-3 text-left font-medium text-micro text-foreground/75';
  return (
    <thead className={layout === 'mobile' ? 'sr-only' : 'block'}>
      <tr
        className={cn(
          tableGridClass(layout),
          'sticky top-0 z-10 h-10 items-center border-border border-b bg-muted/55',
        )}
      >
        <th scope="col" className={className}>
          {t('browse.table.repository')}
        </th>
        <th
          scope="col"
          className={cn(
            className,
            layout === 'compact' &&
              'absolute h-px w-px overflow-hidden whitespace-nowrap [clip-path:inset(50%)]',
          )}
        >
          {t('browse.table.language')}
        </th>
        <th scope="col" className={className}>
          {t('browse.table.stars')}
        </th>
        <th scope="col" className={className}>
          {t('browse.table.activity')}
        </th>
      </tr>
    </thead>
  );
}

export const RepoTable = memo(function RepoTable({
  records,
  semanticStartIndex,
  collectionsByRepo,
  noteRepoIds,
  explanations,
  selectedRepoId,
  onSelect,
  scrollElement,
  bulkSelection,
}: {
  records: StarredRepoRecord[];
  semanticStartIndex?: number | null;
  collectionsByRepo?: Map<string, RepoCardCollection[]>;
  noteRepoIds?: Set<string>;
  explanations?: Map<string, MatchExplanation>;
  selectedRepoId?: string;
  onSelect?: (record: StarredRepoRecord, modality: RepoOpenModality) => void;
  scrollElement?: HTMLElement | null;
  bulkSelection?: BulkSelectionController;
}) {
  const { t } = useTranslation();
  const tableRef = useRef<HTMLTableElement>(null);
  const layout = useTableLayout(tableRef);
  const [resolvedScroll, setResolvedScroll] = useState<HTMLElement | null>(scrollElement ?? null);
  const scrollMargin = useScrollMargin(tableRef, resolvedScroll);

  useEffect(() => {
    if (scrollElement) {
      setResolvedScroll(scrollElement);
      return;
    }
    setResolvedScroll(findScrollParent(tableRef.current));
  }, [scrollElement]);

  // 只虚拟化关键词命中集；有界语义近邻在分隔线下静态追加（与网格视图一致）。
  const primaryCount = semanticStartIndex ?? records.length;
  const semanticRecords = semanticStartIndex != null ? records.slice(semanticStartIndex) : [];

  const virtualizer = useVirtualizer({
    count: primaryCount,
    getScrollElement: () => resolvedScroll,
    estimateSize: () => (layout === 'mobile' ? MOBILE_ROW_HEIGHT : DESKTOP_ROW_HEIGHT),
    overscan: 10,
    scrollMargin,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const firstItem = virtualItems[0];
  const lastItem = virtualItems.at(-1);
  const paddingTop = firstItem ? firstItem.start - scrollMargin : 0;
  const paddingBottom = lastItem ? virtualizer.getTotalSize() - (lastItem.end - scrollMargin) : 0;

  // biome-ignore lint/correctness/useExhaustiveDependencies: container topology changes row measurements
  useEffect(() => {
    virtualizer.measure();
  }, [layout, virtualizer]);

  useEffect(() => {
    if (!selectedRepoId || !resolvedScroll) {
      return;
    }
    const index = records.findIndex((record) => record.repoId === selectedRepoId);
    if (index >= 0 && index < primaryCount) {
      virtualizer.scrollToIndex(index, { align: 'auto' });
    }
  }, [primaryCount, records, resolvedScroll, selectedRepoId, virtualizer]);

  return (
    <table
      ref={tableRef}
      data-layout={layout}
      aria-label={t('browse.table.label')}
      aria-colcount={4}
      aria-rowcount={records.length + 1}
      className="block w-full overflow-clip rounded-lg border bg-card text-card-foreground"
    >
      <TableHeader layout={layout} />
      <tbody className="block">
        {paddingTop > 0 ? (
          <tr className="block">
            <td
              aria-hidden="true"
              colSpan={4}
              className="block p-0"
              style={{ height: paddingTop }}
            />
          </tr>
        ) : null}
        {virtualItems.map((virtualRow) => {
          const record = records[virtualRow.index];
          if (!record) {
            return null;
          }
          return (
            <RepoTableRow
              key={record.repo.githubId}
              record={record}
              collections={collectionsByRepo?.get(record.repoId)}
              hasNote={noteRepoIds?.has(record.repoId)}
              explanation={explanations?.get(record.repoId)}
              selected={record.repoId === selectedRepoId}
              layout={layout}
              onSelect={onSelect}
              rowIndex={virtualRow.index + 2}
              measureElement={virtualizer.measureElement}
              bulkSelection={bulkSelection}
            />
          );
        })}
        {paddingBottom > 0 ? (
          <tr className="block">
            <td
              aria-hidden="true"
              colSpan={4}
              className="block p-0"
              style={{ height: paddingBottom }}
            />
          </tr>
        ) : null}
        {semanticRecords.length > 0 ? (
          <>
            <tr className="block">
              <td aria-hidden="true" colSpan={4} className="block px-3 py-2.5">
                <SemanticSectionLabel />
              </td>
            </tr>
            {semanticRecords.map((record, offset) => (
              <RepoTableRow
                key={record.repo.githubId}
                className="repo-semantic-enter"
                record={record}
                collections={collectionsByRepo?.get(record.repoId)}
                hasNote={noteRepoIds?.has(record.repoId)}
                explanation={explanations?.get(record.repoId)}
                selected={record.repoId === selectedRepoId}
                layout={layout}
                onSelect={onSelect}
                rowIndex={primaryCount + offset + 2}
                measureElement={NOOP_MEASURE_ELEMENT}
                bulkSelection={bulkSelection}
              />
            ))}
          </>
        ) : null}
      </tbody>
    </table>
  );
});
