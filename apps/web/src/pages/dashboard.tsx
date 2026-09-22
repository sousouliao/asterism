import { deriveDashboardInsights, type Memory } from '@asterism/core';
import { Button } from '@asterism/ui';
import {
  ActivityIcon,
  AlertTriangleIcon,
  FolderIcon,
  LanguagesIcon,
  LoaderCircleIcon,
  LogInIcon,
  NotebookPenIcon,
  RefreshCwIcon,
  StarIcon,
} from 'lucide-react';
import { lazy, Suspense, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '../auth/use-session';
import { DashboardCharts } from '../components/dashboard/dashboard-charts';
import { StatCard } from '../components/dashboard/stat-card';
import { EmptyState } from '../components/empty-state';
import { LoadingRegion } from '../components/loading-region';
import { PageHeader } from '../components/page-header';
import {
  DashboardChartsSkeleton,
  DashboardContentSkeleton,
} from '../components/page-loading-states';
import { ResurfaceSection } from '../components/resurface/resurface-section';
import { ResurfaceSectionSkeleton } from '../components/resurface/resurface-skeleton';
import { useCollectionRepos } from '../data/use-collection-repos';
import { useCollections } from '../data/use-collections';
import { useMemoriesList } from '../data/use-memories-list';
import { useStarredRepos } from '../data/use-starred-repos';
import { useSyncStars } from '../data/use-sync-stars';

const LazyDashboardCharts = lazy(async () => ({
  default: DashboardCharts,
}));

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { session } = useSession();
  const userId = session?.user.id;
  const {
    data: starredRepos,
    isLoading: starredReposLoading,
    isError,
    refetch,
    isFetching,
  } = useStarredRepos();
  const { data: collections, isLoading: collectionsLoading } = useCollections();
  const { data: collectionRepos, isLoading: collectionReposLoading } = useCollectionRepos();
  const {
    data: memories,
    isLoading: memoriesLoading,
    isError: memoriesError,
    refetch: refetchMemories,
  } = useMemoriesList();
  const isLoading = starredReposLoading || collectionsLoading || collectionReposLoading;
  const sync = useSyncStars();
  const syncPending = sync.requiresReconnect ? sync.reconnectPending : sync.isPending;

  const records = useMemo(() => starredRepos ?? [], [starredRepos]);
  const memoriesByRepoId = useMemo(
    () => new Map<string, Memory>((memories ?? []).map((memory) => [memory.repoId, memory])),
    [memories],
  );

  const insights = useMemo(
    () =>
      deriveDashboardInsights({
        starredRepos: records,
        collections: (collections ?? []).map(({ id, name, description }) => ({
          id,
          name,
          description,
        })),
        collectionRepos: collectionRepos ?? [],
      }),
    [records, collections, collectionRepos],
  );

  const recordedMemoryCount = useMemo(
    () => (memories ?? []).filter((m) => Boolean(m.whySaved?.trim() || m.note?.trim())).length,
    [memories],
  );

  const formatCount = (value: number) => new Intl.NumberFormat(i18n.language).format(value);

  return (
    <div className="asterism-scroll-gutter -m-6 min-h-0 flex-1 overflow-y-auto px-6 pt-6 pb-24">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <PageHeader title={t('dashboard.title')} description={t('dashboard.subtitle')} />

        {isLoading ? (
          <LoadingRegion label={t('loading.dashboard')} className="flex flex-col gap-6">
            <DashboardContentSkeleton />
          </LoadingRegion>
        ) : isError ? (
          <EmptyState
            icon={AlertTriangleIcon}
            title={t('dashboard.errorTitle')}
            description={t('dashboard.errorDescription')}
            action={
              <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCwIcon className="size-4" />
                {t('browse.retry')}
              </Button>
            }
          />
        ) : records.length === 0 ? (
          <EmptyState
            icon={StarIcon}
            title={t('dashboard.emptyTitle')}
            description={t('dashboard.emptyDescription')}
            action={
              <Button onClick={sync.sync} disabled={syncPending}>
                {sync.requiresReconnect ? (
                  sync.reconnectPending ? (
                    <LoaderCircleIcon className="size-4 animate-spin motion-reduce:animate-none" />
                  ) : (
                    <LogInIcon className="size-4" />
                  )
                ) : (
                  <RefreshCwIcon
                    className={
                      sync.isPending ? 'size-4 animate-spin motion-reduce:animate-none' : 'size-4'
                    }
                  />
                )}
                {sync.requiresReconnect
                  ? sync.reconnectPending
                    ? t('sync.reconnecting')
                    : t('sync.reconnectAction')
                  : t('browse.syncAction')}
              </Button>
            }
          />
        ) : (
          <>
            {memoriesLoading ? (
              <ResurfaceSectionSkeleton />
            ) : memoriesError ? (
              // 记忆是唤醒的全部依据：加载失败必须说明，静默留白会被读成「无内容可唤醒」。
              <div
                role="alert"
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
              >
                <p className="text-destructive text-sm">{t('dashboard.resurface.loadError')}</p>
                <Button variant="outline" size="sm" onClick={() => void refetchMemories()}>
                  {t('common.retry')}
                </Button>
              </div>
            ) : !memories ? null : (
              <ResurfaceSection
                records={records}
                memoriesByRepoId={memoriesByRepoId}
                userId={userId}
              />
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={StarIcon}
                label={t('dashboard.totalStars')}
                value={formatCount(insights.stats.totalStars)}
              />
              <StatCard
                icon={LanguagesIcon}
                label={t('dashboard.languages')}
                value={formatCount(insights.stats.languageCount)}
              />
              <StatCard
                icon={NotebookPenIcon}
                label={t('dashboard.memoriesCount')}
                value={formatCount(recordedMemoryCount)}
                subtext={
                  records.length > 0
                    ? `${Math.round((recordedMemoryCount / records.length) * 100)}%`
                    : undefined
                }
              />
              {insights.stats.collectionCount > 0 ? (
                <StatCard
                  icon={FolderIcon}
                  label={t('dashboard.collections')}
                  value={formatCount(insights.stats.collectionCount)}
                  subtext={t('dashboard.reposCount', {
                    count: insights.stats.collectedRepoCount,
                  })}
                />
              ) : (
                <StatCard
                  icon={ActivityIcon}
                  label={t('dashboard.activeRate')}
                  value={
                    records.length > 0
                      ? `${Math.round((insights.archiveSplit.active / records.length) * 100)}%`
                      : '0%'
                  }
                  subtext={t('dashboard.archiveStatus', {
                    active: insights.archiveSplit.active,
                    archived: insights.archiveSplit.archived,
                  })}
                />
              )}
            </div>

            <Suspense
              fallback={
                <LoadingRegion label={t('loading.charts')}>
                  <DashboardChartsSkeleton count={4} />
                </LoadingRegion>
              }
            >
              <LazyDashboardCharts insights={insights} />
            </Suspense>
          </>
        )}
      </div>
    </div>
  );
}
