import type { MatchExplanation } from '@asterism/core';
import type { StarredRepoRecord } from '@asterism/db';
import { memo, useEffect, useState } from 'react';
import type { BulkSelectionController } from '../lib/bulk-selection';
import type { RepoViewMode } from '../stores/browse-view';
import type { RepoOpenModality } from '../stores/repo-inspector';
import type { RepoCardCollection } from './repo-card-context';
import { RepoCollection } from './repo-collection';

const VIEW_MODES = ['grid', 'list'] as const satisfies readonly RepoViewMode[];

export const BrowseRepoList = memo(function BrowseRepoList({
  view,
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
  view: RepoViewMode;
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
  // 访问过的视图保持挂载，后续切换只做显隐，避开虚拟列表重建成本。
  const [mountedViews, setMountedViews] = useState<ReadonlySet<RepoViewMode>>(
    () => new Set([view]),
  );

  useEffect(() => {
    setMountedViews((prev) => (prev.has(view) ? prev : new Set(prev).add(view)));
  }, [view]);

  return (
    <div className="relative min-h-[280px] w-full">
      {VIEW_MODES.map((mode) =>
        mountedViews.has(mode) ? (
          <div
            key={mode}
            data-repo-view-active={mode === view}
            className={mode === view ? undefined : 'hidden'}
          >
            <RepoCollection
              records={records}
              semanticStartIndex={semanticStartIndex}
              view={mode}
              collectionsByRepo={collectionsByRepo}
              noteRepoIds={noteRepoIds}
              explanations={explanations}
              selectedRepoId={selectedRepoId}
              onSelect={onSelect}
              scrollElement={mode === view ? scrollElement : null}
              bulkSelection={bulkSelection}
            />
          </div>
        ) : null,
      )}
    </div>
  );
});
