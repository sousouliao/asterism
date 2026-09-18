import { Button } from '@asterism/ui';
import { ArrowLeftIcon, FolderIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { EmptyState } from '../components/empty-state';
import { CollectionDetailRouteLoading } from '../components/page-loading-states';
import type { RepoCardCollection } from '../components/repo-card-context';
import { RepoCollection } from '../components/repo-collection';
import { useRepoInspector } from '../contexts/repo-inspector-context';
import { useCollectionRepos } from '../data/use-collection-repos';
import { useCollections } from '../data/use-collections';
import { useStarredRepos } from '../data/use-starred-repos';
import { useReadmeReturnRestore } from '../hooks/use-readme-return-restore';
import { useListScrollStore } from '../stores/list-scroll';
import { useRepoInspectorStore } from '../stores/repo-inspector';

export function CollectionDetailPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { requestOpen, registerContext } = useRepoInspector();
  const selectedRepoId = useRepoInspectorStore((state) => state.record?.repoId);
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);

  const { data: collections, isLoading: collectionsLoading } = useCollections();
  const { data: starredRepos, isLoading: reposLoading } = useStarredRepos();
  const { data: collectionRepos, isLoading: linksLoading } = useCollectionRepos();

  const collection = useMemo(
    () => (collections ?? []).find((item) => item.id === id),
    [collections, id],
  );

  const memberRecords = useMemo(() => {
    if (!collection || !starredRepos) {
      return [];
    }
    const memberIds = new Set(
      (collectionRepos ?? [])
        .filter((link) => link.collectionId === collection.id)
        .map((link) => link.repoId),
    );
    return starredRepos.filter((record) => memberIds.has(record.repoId));
  }, [collection, collectionRepos, starredRepos]);

  const collectionsByRepo = useMemo(() => {
    const byId = new Map(
      (collections ?? []).map((item) => [
        item.id,
        { id: item.id, name: item.name } satisfies RepoCardCollection,
      ]),
    );
    const map = new Map<string, RepoCardCollection[]>();
    for (const link of collectionRepos ?? []) {
      const item = byId.get(link.collectionId);
      if (!item) {
        continue;
      }
      const list = map.get(link.repoId);
      if (list) {
        list.push(item);
      } else {
        map.set(link.repoId, [item]);
      }
    }
    return map;
  }, [collections, collectionRepos]);

  const sourceKey = `collection:${id ?? 'unknown'}`;
  const inspectorContext = useMemo(
    () => ({
      sourceKey,
      sourceName: collection?.name,
      records: memberRecords,
    }),
    [collection?.name, memberRecords, sourceKey],
  );
  const openInspector = useCallback(
    (record: (typeof memberRecords)[number], modality: 'keyboard' | 'pointer') =>
      requestOpen(record, inspectorContext, modality),
    [inspectorContext, requestOpen],
  );

  useEffect(() => {
    registerContext(inspectorContext);
  }, [inspectorContext, registerContext]);

  useEffect(() => {
    const el = scrollElement;
    if (!el) {
      return;
    }
    const update = () => useListScrollStore.getState().setScrollTop(sourceKey, el.scrollTop);
    update();
    el.addEventListener('scroll', update, { passive: true });
    return () => el.removeEventListener('scroll', update);
  }, [scrollElement, sourceKey]);

  const isLoading = collectionsLoading || reposLoading || linksLoading;
  const count = new Intl.NumberFormat(i18n.language).format(memberRecords.length);

  useReadmeReturnRestore({
    sourceKey,
    records: memberRecords,
    scrollElement,
    inspectorContext,
    requestOpen,
    ready: !isLoading,
    collectionMissing: !isLoading && !collection,
  });

  if (isLoading) {
    return <CollectionDetailRouteLoading label={t('loading.collection')} />;
  }

  if (!collection) {
    return (
      <div className="-m-6 min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
          <Button variant="ghost" size="sm" className="w-fit gap-1" asChild>
            <Link to="/collections">
              <ArrowLeftIcon className="size-4" />
              {t('collectionDetail.back')}
            </Link>
          </Button>
          <EmptyState
            icon={FolderIcon}
            title={t('collectionDetail.notFoundTitle')}
            description={t('collectionDetail.notFoundDescription')}
          />
        </div>
      </div>
    );
  }

  return (
    <div ref={setScrollElement} className="-m-6 min-h-0 flex-1 overflow-y-auto px-6 py-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <Button variant="ghost" size="sm" className="w-fit gap-1" asChild>
          <Link to="/collections">
            <ArrowLeftIcon className="size-4" />
            {t('collectionDetail.back')}
          </Link>
        </Button>

        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-accent">
            <FolderIcon className="size-6 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-bold text-page-title text-foreground tracking-tight">
              {collection.name}
            </h1>
            {collection.description ? (
              <p className="mt-1 text-[13px] text-muted-foreground leading-5">
                {collection.description}
              </p>
            ) : null}
            <p className="mt-2 text-caption text-muted-foreground">
              {t('collectionDetail.repoCount', { count })}
            </p>
          </div>
        </div>

        {memberRecords.length === 0 ? (
          <EmptyState
            icon={FolderIcon}
            title={t('collectionDetail.emptyTitle')}
            description={t('collectionDetail.emptyDescription')}
          />
        ) : (
          <RepoCollection
            records={memberRecords}
            view="list"
            collectionsByRepo={collectionsByRepo}
            selectedRepoId={selectedRepoId}
            onSelect={openInspector}
            scrollElement={scrollElement}
          />
        )}
      </div>
    </div>
  );
}
