import { Button, cn, Input } from '@asterism/ui';
import { CheckIcon, PlusIcon } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCollectionRepos, useToggleCollectionRepo } from '../../data/use-collection-repos';
import { useCollections } from '../../data/use-collections';
import { getVisibleLabeledFacetOptions } from '../facet-options';
import { SearchInputIcon } from '../search-input-icon';
import { SectionLabel, WriteRecovery } from './section-label';

export function CollectionsSection({ repoId }: { repoId: string }) {
  const { t } = useTranslation();
  const { data: collections = [] } = useCollections();
  const { data: links = [] } = useCollectionRepos();
  const toggle = useToggleCollectionRepo();
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const memberIds = useMemo(
    () => new Set(links.filter((link) => link.repoId === repoId).map((link) => link.collectionId)),
    [links, repoId],
  );
  const memberIdList = useMemo(() => [...memberIds], [memberIds]);
  const selected = collections.filter((collection) => memberIds.has(collection.id));
  const options = useMemo(
    () => collections.map((collection) => ({ value: collection.id, label: collection.name })),
    [collections],
  );
  const visibleOptions = useMemo(
    () => getVisibleLabeledFacetOptions(options, deferredQuery, memberIdList),
    [options, deferredQuery, memberIdList],
  );

  useEffect(() => {
    if (!editing) {
      setQuery('');
    }
  }, [editing]);

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <SectionLabel>{t('drawer.collections')}</SectionLabel>
        {collections.length > 0 ? (
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-caption text-link"
            onClick={() => setEditing((value) => !value)}
          >
            {editing ? t('common.done') : t('common.edit')}
          </Button>
        ) : null}
      </div>
      {collections.length === 0 ? (
        <p className="text-body text-muted-foreground">{t('drawer.noCollections')}</p>
      ) : editing ? (
        <div className="flex flex-col gap-2">
          <div className="relative">
            <SearchInputIcon className="left-2.5" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('drawer.searchCollections')}
              aria-label={t('drawer.searchCollections')}
              className="pl-8"
            />
          </div>
          <div className="flex flex-col gap-1">
            {visibleOptions.items.map((option) => {
              const member = memberIds.has(option.value);
              return (
                <Button
                  key={option.value}
                  type="button"
                  variant="ghost"
                  disabled={toggle.isPending}
                  onClick={() => toggle.mutate({ collectionId: option.value, repoId, member })}
                  className={cn(
                    'h-8 w-full justify-between rounded-sm px-2 text-left text-body',
                    member
                      ? 'bg-background text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  {member ? <CheckIcon className="size-4 shrink-0 text-link" /> : null}
                </Button>
              );
            })}
            {visibleOptions.total === 0 ? (
              <p className="px-2 py-1 text-caption text-muted-foreground">
                {t('filters.noResults')}
              </p>
            ) : null}
            {visibleOptions.truncated ? (
              <p className="px-2 text-micro text-muted-foreground">
                {t('filters.showingTopResults', { count: visibleOptions.items.length })}
              </p>
            ) : null}
          </div>
        </div>
      ) : selected.length === 0 ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => setEditing(true)}
        >
          <PlusIcon className="size-3.5" />
          {t('drawer.addCollection')}
        </Button>
      ) : (
        <div className="flex flex-col gap-1">
          {selected.map((collection) => (
            <div
              key={collection.id}
              className="flex h-8 items-center rounded-sm px-2 text-body text-foreground"
            >
              <span className="truncate">{collection.name}</span>
            </div>
          ))}
        </div>
      )}
      {toggle.isError && toggle.variables ? (
        <WriteRecovery
          message={t('drawer.collectionUpdateError')}
          pending={toggle.isPending}
          onRetry={() => toggle.mutate(toggle.variables)}
          onCancel={() => toggle.reset()}
        />
      ) : null}
    </section>
  );
}
