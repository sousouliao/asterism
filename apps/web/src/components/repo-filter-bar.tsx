import { hasActiveFilter, type RepoFacets, type RepoSort, type RepoStatus } from '@asterism/core';
import {
  Badge,
  Button,
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@asterism/ui';
import { ArrowUpDownIcon, ChevronDownIcon, SlidersHorizontalIcon, XIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toRepoFilter, useBrowseFilters } from '../stores/browse-filters';
import { FacetPicker, MultiFacetPicker } from './facet-picker';
import {
  FILTER_TRIGGER_ACTIVE_CLASS,
  FILTER_TRIGGER_CHEVRON_CLASS,
  FILTER_TRIGGER_CLASS,
  FILTER_TRIGGER_COUNT_CLASS,
  FILTER_TRIGGER_ICON_CLASS,
  FILTER_TRIGGER_LABEL_CLASS,
} from './filter-trigger';

const ALL = '__all__';
const STAR_THRESHOLDS = [100, 1000, 10000, 50000];
const PUSHED_WINDOWS = [7, 30, 90, 365];

export function RepoFilterBar({
  facets,
  collections,
  children,
}: {
  facets: RepoFacets;
  collections: { id: string; name: string }[];
  children?: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const filters = useBrowseFilters();
  const active = hasActiveFilter(toRepoFilter(filters));
  const collectionOptions = useMemo(
    () => collections.map((collection) => ({ value: collection.id, label: collection.name })),
    [collections],
  );
  const moreFilterCount =
    Number(filters.minStars > 0) +
    Number(filters.pushedWithinDays !== null) +
    Number(filters.status !== 'all');

  return (
    <div className="flex w-full flex-wrap items-center gap-1.5 gap-y-2">
      <FacetPicker
        value={filters.language}
        options={facets.languages}
        triggerLabel={t('filters.language')}
        allLabel={t('filters.allLanguages')}
        searchLabel={t('filters.searchLanguages')}
        emptyLabel={t('filters.noResults')}
        resultsHint={(count) => t('filters.showingTopResults', { count })}
        onValueChange={filters.setLanguage}
      />

      <FacetPicker
        value={filters.topic}
        options={facets.topics}
        triggerLabel={t('filters.topic')}
        allLabel={t('filters.allTopics')}
        searchLabel={t('filters.searchTopics')}
        emptyLabel={t('filters.noResults')}
        resultsHint={(count) => t('filters.showingTopResults', { count })}
        onValueChange={filters.setTopic}
      />

      {collections.length > 0 ? (
        <MultiFacetPicker
          values={filters.collectionIds}
          options={collectionOptions}
          triggerLabel={t('filters.collections')}
          searchLabel={t('filters.searchCollections')}
          emptyLabel={t('filters.noResults')}
          resultsHint={(count) => t('filters.showingTopResults', { count })}
          onToggle={filters.toggleCollectionId}
        />
      ) : null}

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(FILTER_TRIGGER_CLASS, moreFilterCount > 0 && FILTER_TRIGGER_ACTIVE_CLASS)}
          >
            <SlidersHorizontalIcon className={FILTER_TRIGGER_ICON_CLASS} />
            <span className={FILTER_TRIGGER_LABEL_CLASS}>{t('filters.more')}</span>
            {moreFilterCount > 0 ? (
              <Badge variant="secondary" className={FILTER_TRIGGER_COUNT_CLASS}>
                {moreFilterCount}
              </Badge>
            ) : null}
            <ChevronDownIcon className={FILTER_TRIGGER_CHEVRON_CLASS} />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="pointer-events-auto w-72 space-y-3 p-3">
          <div className="space-y-1.5">
            <p className="font-medium text-xs">{t('filters.stars')}</p>
            <Select
              value={String(filters.minStars)}
              onValueChange={(value) => filters.setMinStars(Number(value))}
            >
              <SelectTrigger size="sm" className="w-full" aria-label={t('filters.stars')}>
                <SelectValue placeholder={t('filters.stars')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">{t('filters.anyStars')}</SelectItem>
                {STAR_THRESHOLDS.map((threshold) => (
                  <SelectItem key={threshold} value={String(threshold)}>
                    {t('filters.minStars', {
                      value: new Intl.NumberFormat(i18n.language).format(threshold),
                    })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <p className="font-medium text-xs">{t('filters.pushed')}</p>
            <Select
              value={filters.pushedWithinDays === null ? ALL : String(filters.pushedWithinDays)}
              onValueChange={(value) =>
                filters.setPushedWithinDays(value === ALL ? null : Number(value))
              }
            >
              <SelectTrigger size="sm" className="w-full" aria-label={t('filters.pushed')}>
                <SelectValue placeholder={t('filters.pushed')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('filters.anyTime')}</SelectItem>
                {PUSHED_WINDOWS.map((days) => (
                  <SelectItem key={days} value={String(days)}>
                    {t('filters.pushedWithin', { value: days })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <p className="font-medium text-xs">{t('filters.status')}</p>
            <Select
              value={filters.status}
              onValueChange={(value) => filters.setStatus(value as RepoStatus)}
            >
              <SelectTrigger size="sm" className="w-full" aria-label={t('filters.status')}>
                <SelectValue placeholder={t('filters.status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filters.statusAll')}</SelectItem>
                <SelectItem value="active">{t('filters.statusActive')}</SelectItem>
                <SelectItem value="archived">{t('filters.statusArchived')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </PopoverContent>
      </Popover>

      {active ? (
        <Button
          variant="ghost"
          size="sm"
          className="size-8 gap-1 px-0 text-muted-foreground"
          onClick={filters.reset}
          aria-label={t('filters.clear')}
          title={t('filters.clear')}
        >
          <XIcon className="size-4" />
        </Button>
      ) : null}

      <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:ml-auto">
        <Select value={filters.sort} onValueChange={(value) => filters.setSort(value as RepoSort)}>
          <SelectTrigger size="sm" className={FILTER_TRIGGER_CLASS} aria-label={t('filters.sort')}>
            <ArrowUpDownIcon className={FILTER_TRIGGER_ICON_CLASS} />
            {/* Radix 的 SelectValue 会丢弃传入的 className，弹性由这层承担。 */}
            <span className={FILTER_TRIGGER_LABEL_CLASS}>
              <SelectValue />
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="starred">{t('filters.sortStarred')}</SelectItem>
            <SelectItem value="pushed">{t('filters.sortPushed')}</SelectItem>
            <SelectItem value="stars">{t('filters.sortStars')}</SelectItem>
            <SelectItem value="name">{t('filters.sortName')}</SelectItem>
          </SelectContent>
        </Select>

        {children ? <div className="flex shrink-0 items-center">{children}</div> : null}
      </div>
    </div>
  );
}
