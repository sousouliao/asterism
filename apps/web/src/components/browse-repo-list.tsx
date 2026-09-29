import type { MatchExplanation } from '@asterism/core';
import type { StarredRepoRecord } from '@asterism/db';
import { memo } from 'react';
import type { BulkSelectionController } from '../lib/bulk-selection';
import type { RepoViewMode } from '../stores/browse-view';
import type { RepoOpenModality } from '../stores/repo-inspector';
import type { RepoCardCollection } from './repo-card-context';
import { RepoCollection } from './repo-collection';

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
  return (
    <div className="relative min-h-[280px] w-full">
      <RepoCollection
        records={records}
        semanticStartIndex={semanticStartIndex}
        view={view}
        collectionsByRepo={collectionsByRepo}
        noteRepoIds={noteRepoIds}
        explanations={explanations}
        selectedRepoId={selectedRepoId}
        onSelect={onSelect}
        scrollElement={scrollElement}
        bulkSelection={bulkSelection}
      />
    </div>
  );
});
