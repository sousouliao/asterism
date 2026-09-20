import { deriveResurfaceStreams, type Memory, type ResurfaceCandidate } from '@asterism/core';
import type { StarredRepoRecord } from '@asterism/db';
import { HistoryIcon, PenLineIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRepoInspector } from '../../contexts/repo-inspector-context';
import {
  type ResurfaceFeedbackAction,
  recordResurfaceFeedback,
  useResurfaceSuppressedRepoIds,
} from '../../lib/resurface-feedback';
import type { RepoOpenModality } from '../../stores/repo-inspector';
import { useRepoInspectorStore } from '../../stores/repo-inspector';
import { ResurfaceCard } from './resurface-card';

export interface ResurfaceSectionProps {
  records: StarredRepoRecord[];
  memoriesByRepoId: ReadonlyMap<string, Memory>;
  userId: string | undefined;
}

export function ResurfaceSection({ records, memoriesByRepoId, userId }: ResurfaceSectionProps) {
  const { t } = useTranslation();
  const inspector = useRepoInspector();
  const selectedRepoId = useRepoInspectorStore((state) => state.record?.repoId);
  // 挂载时固定一次时间基准：纪念日窗口按天粒度判定，无需逐帧重算。
  const [now] = useState(() => Date.now());
  const suppressed = useResurfaceSuppressedRepoIds(userId);

  const streams = useMemo(
    () =>
      deriveResurfaceStreams({
        items: records,
        memoriesByRepoId,
        suppressedRepoIds: suppressed,
        now,
      }),
    [records, memoriesByRepoId, suppressed, now],
  );

  const candidateRecords = useMemo(
    () => [...streams.worthRemembering, ...streams.missingContext].map((entry) => entry.item),
    [streams],
  );
  const inspectorContext = useMemo(
    () => ({
      sourceKey: 'resurface',
      sourceName: t('dashboard.resurface.title'),
      records: candidateRecords,
    }),
    [candidateRecords, t],
  );

  const handleSelect = useCallback(
    (record: StarredRepoRecord, modality: RepoOpenModality) => {
      inspector.requestOpen(record, inspectorContext, modality);
    },
    [inspector, inspectorContext],
  );

  // 无会话时反馈无处可存，交出 undefined 让卡片隐藏控件，而不是留一个点了没反应的按钮。
  const handleFeedback = useMemo(
    () =>
      userId
        ? (repoId: string, action: ResurfaceFeedbackAction) => {
            recordResurfaceFeedback(userId, repoId, action);
          }
        : undefined,
    [userId],
  );

  useEffect(() => {
    inspector.registerContext(inspectorContext);
  }, [inspector, inspectorContext]);

  if (streams.worthRemembering.length === 0 && streams.missingContext.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="resurface-section-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2
          id="resurface-section-title"
          className="font-semibold text-section-title tracking-tight text-foreground"
        >
          {t('dashboard.resurface.title')}
        </h2>
        <p className="text-body text-muted-foreground">{t('dashboard.resurface.description')}</p>
      </div>

      <StreamGroup
        label={t('dashboard.resurface.worthRemembering')}
        Icon={HistoryIcon}
        candidates={streams.worthRemembering}
        memoriesByRepoId={memoriesByRepoId}
        selectedRepoId={selectedRepoId}
        onSelect={handleSelect}
        onFeedback={handleFeedback}
      />

      <StreamGroup
        label={t('dashboard.resurface.missingContext')}
        Icon={PenLineIcon}
        candidates={streams.missingContext}
        memoriesByRepoId={memoriesByRepoId}
        selectedRepoId={selectedRepoId}
        onSelect={handleSelect}
        onFeedback={handleFeedback}
      />
    </section>
  );
}

function StreamGroup({
  label,
  Icon,
  candidates,
  memoriesByRepoId,
  selectedRepoId,
  onSelect,
  onFeedback,
}: {
  label: string;
  Icon: typeof HistoryIcon;
  candidates: ResurfaceCandidate<StarredRepoRecord>[];
  memoriesByRepoId: ReadonlyMap<string, Memory>;
  selectedRepoId: string | undefined;
  onSelect: (record: StarredRepoRecord, modality: RepoOpenModality) => void;
  onFeedback?: (repoId: string, action: ResurfaceFeedbackAction) => void;
}) {
  if (candidates.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="flex items-center gap-1.5 font-medium text-caption text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </h3>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {candidates.map((candidate) => (
          <ResurfaceCard
            key={candidate.repoId}
            candidate={candidate}
            memory={memoriesByRepoId.get(candidate.repoId)}
            selected={candidate.repoId === selectedRepoId}
            onSelect={onSelect}
            onFeedback={onFeedback}
          />
        ))}
      </div>
    </div>
  );
}
