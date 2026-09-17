import type { MatchExplanation } from '@asterism/core';
import type { StarredRepoRecord } from '@asterism/db';
import { useVirtualizer } from '@tanstack/react-virtual';
import { memo, useEffect, useRef, useState } from 'react';
import type { BulkSelectionController } from '../lib/bulk-selection';
import { useScrollMargin } from '../lib/scroll-margin';
import type { RepoViewMode } from '../stores/browse-view';
import type { RepoOpenModality } from '../stores/repo-inspector';
import { RepoCard } from './repo-card';
import type { RepoCardCollection } from './repo-card-context';
import { RepoTable } from './repo-table';
import { SemanticSectionLabel } from './semantic-section-separator';

const MIN_CARD_WIDTH = 370;
const CARD_GAP = 16;
const MAX_COLUMNS = 3;

type RepoCollectionProps = {
  records: StarredRepoRecord[];
  /** 语义近邻起始下标（records 中）；null / 缺省表示无近邻，不渲染分隔线。 */
  semanticStartIndex?: number | null;
  collectionsByRepo?: Map<string, RepoCardCollection[]>;
  noteRepoIds?: Set<string>;
  explanations?: Map<string, MatchExplanation>;
  selectedRepoId?: string;
  onSelect?: (record: StarredRepoRecord, modality: RepoOpenModality) => void;
  scrollElement?: HTMLElement | null;
  bulkSelection?: BulkSelectionController;
};

function useColumns(ref: React.RefObject<HTMLElement | null>): number {
  const [columns, setColumns] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const update = () => {
      const next = Math.max(
        1,
        Math.min(
          MAX_COLUMNS,
          Math.floor((el.clientWidth + CARD_GAP) / (MIN_CARD_WIDTH + CARD_GAP)),
        ),
      );
      setColumns(next);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return columns;
}

const RepoGridView = memo(function RepoGridView({
  records,
  semanticStartIndex,
  collectionsByRepo,
  noteRepoIds,
  explanations,
  selectedRepoId,
  onSelect,
  scrollElement,
  bulkSelection,
}: RepoCollectionProps) {
  const collectionRef = useRef<HTMLDivElement>(null);
  const scrollMargin = useScrollMargin(collectionRef, scrollElement);
  const columns = useColumns(collectionRef);
  // 只虚拟化（可能很大的）关键词命中集；有界的语义近邻（≤semanticLimit）在分隔线下静态追加。
  const primaryCount = semanticStartIndex ?? records.length;
  const semanticRecords = semanticStartIndex != null ? records.slice(semanticStartIndex) : [];
  const rowCount = Math.ceil(primaryCount / columns);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollElement ?? null,
    estimateSize: () => 224,
    overscan: 6,
    scrollMargin,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: columns/records 改变即需重测
  useEffect(() => {
    virtualizer.measure();
  }, [virtualizer, columns, primaryCount, scrollMargin]);

  useEffect(() => {
    if (!selectedRepoId || !scrollElement) {
      return;
    }
    const index = records.findIndex((record) => record.repoId === selectedRepoId);
    if (index >= 0 && index < primaryCount) {
      virtualizer.scrollToIndex(Math.floor(index / columns), { align: 'auto' });
    }
  }, [columns, primaryCount, records, scrollElement, selectedRepoId, virtualizer]);

  return (
    <div ref={collectionRef} className="relative w-full">
      <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((row) => {
          const start = row.index * columns;
          const rowRecords = records.slice(start, Math.min(start + columns, primaryCount));
          return (
            <div
              key={row.key}
              data-index={row.index}
              ref={virtualizer.measureElement}
              className="absolute top-0 left-0 w-full"
              style={{ transform: `translateY(${row.start - scrollMargin}px)` }}
            >
              <div
                className="grid gap-4 pb-4"
                style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
              >
                {rowRecords.map((record) => (
                  <RepoCard
                    key={record.repo.githubId}
                    record={record}
                    collections={collectionsByRepo?.get(record.repoId)}
                    hasNote={noteRepoIds?.has(record.repoId)}
                    explanation={explanations?.get(record.repoId)}
                    selected={record.repoId === selectedRepoId}
                    onSelect={onSelect}
                    bulkSelection={bulkSelection}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {semanticRecords.length > 0 ? (
        <div className="pt-2">
          <SemanticSectionLabel className="pb-4" />
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {semanticRecords.map((record) => (
              <RepoCard
                key={record.repo.githubId}
                className="repo-semantic-enter"
                record={record}
                collections={collectionsByRepo?.get(record.repoId)}
                hasNote={noteRepoIds?.has(record.repoId)}
                explanation={explanations?.get(record.repoId)}
                selected={record.repoId === selectedRepoId}
                onSelect={onSelect}
                bulkSelection={bulkSelection}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
});

const RepoListView = memo(function RepoListView({
  records,
  semanticStartIndex,
  collectionsByRepo,
  noteRepoIds,
  explanations,
  selectedRepoId,
  onSelect,
  scrollElement,
  bulkSelection,
}: RepoCollectionProps) {
  return (
    <RepoTable
      records={records}
      semanticStartIndex={semanticStartIndex}
      collectionsByRepo={collectionsByRepo}
      noteRepoIds={noteRepoIds}
      explanations={explanations}
      selectedRepoId={selectedRepoId}
      onSelect={onSelect}
      scrollElement={scrollElement}
      bulkSelection={bulkSelection}
    />
  );
});

// memo 让常驻挂载但当前不可见的那一侧在切换时跳过整棵子树的重渲染，
// 只有真正 props 变化(如 scrollElement 从 null 变为真实节点)的一侧才会重新渲染。
export const RepoCollection = memo(function RepoCollection({
  records,
  semanticStartIndex,
  view,
  collectionsByRepo,
  noteRepoIds,
  explanations,
  selectedRepoId,
  onSelect,
  scrollElement,
  bulkSelection,
}: RepoCollectionProps & { view: RepoViewMode }) {
  if (view === 'list') {
    return (
      <RepoListView
        records={records}
        semanticStartIndex={semanticStartIndex}
        collectionsByRepo={collectionsByRepo}
        noteRepoIds={noteRepoIds}
        explanations={explanations}
        selectedRepoId={selectedRepoId}
        onSelect={onSelect}
        scrollElement={scrollElement}
        bulkSelection={bulkSelection}
      />
    );
  }

  return (
    <RepoGridView
      records={records}
      semanticStartIndex={semanticStartIndex}
      collectionsByRepo={collectionsByRepo}
      noteRepoIds={noteRepoIds}
      explanations={explanations}
      selectedRepoId={selectedRepoId}
      onSelect={onSelect}
      scrollElement={scrollElement}
      bulkSelection={bulkSelection}
    />
  );
});
