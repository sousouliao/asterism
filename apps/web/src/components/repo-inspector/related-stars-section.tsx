import { repoFullName } from '@asterism/core';
import type { StarredRepoRecord } from '@asterism/db';
import { ChevronRightIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useRepoInspector } from '../../contexts/repo-inspector-context';
import { useSemanticNeighborhood } from '../../data/use-semantic-neighborhood';
import { SectionLabel } from './section-label';

export function RelatedStarsSection({ record }: { record: StarredRepoRecord }) {
  const { t } = useTranslation();
  const { requestOpen } = useRepoInspector();
  const related = useSemanticNeighborhood(record.repoId);

  if (related.length === 0) {
    return null;
  }

  const neighborhoodContext = {
    sourceKey: `semantic-neighborhood:${record.repoId}`,
    sourceName: t('drawer.relatedStars'),
    records: [record, ...related],
  };

  return (
    <section className="flex flex-col gap-2">
      <div>
        <SectionLabel>{t('drawer.relatedStars')}</SectionLabel>
        <p className="mt-1 text-micro text-muted-foreground">
          {t('drawer.relatedStarsDescription')}
        </p>
      </div>
      <div className="flex flex-col">
        {related.map((neighbor) => (
          <button
            key={neighbor.repoId}
            type="button"
            aria-label={t('drawer.openRelatedStar', { repo: repoFullName(neighbor.repo) })}
            onClick={() => requestOpen(neighbor, neighborhoodContext, 'pointer')}
            className="group flex min-h-11 w-full min-w-0 items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:bg-accent/80"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body">
                <span className="text-muted-foreground">{neighbor.repo.owner} / </span>
                <span className="font-medium text-foreground">{neighbor.repo.name}</span>
              </span>
              {neighbor.repo.description ? (
                <span className="mt-0.5 block truncate text-micro text-muted-foreground">
                  {neighbor.repo.description}
                </span>
              ) : null}
            </span>
            <ChevronRightIcon
              className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none"
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
    </section>
  );
}
