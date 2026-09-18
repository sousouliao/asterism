import type { ExportSnapshot } from '@asterism/core';
import { Button, toast } from '@asterism/ui';
import {
  DownloadIcon,
  FileJsonIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  LoaderCircleIcon,
  UploadIcon,
} from 'lucide-react';
import { type DragEvent, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../components/empty-state';
import { LoadingRegion } from '../components/loading-region';
import { PageHeader } from '../components/page-header';
import { ImportExportContentSkeleton } from '../components/page-loading-states';
import { useCollectionRepos } from '../data/use-collection-repos';
import { useCollections } from '../data/use-collections';
import {
  downloadText,
  type ExportFormat,
  serializeExport,
  useImportUserData,
} from '../data/use-import-export';
import { useMemoriesList } from '../data/use-memories-list';
import { useStarredRepos } from '../data/use-starred-repos';
import { buildExportSnapshot } from '../lib/export-snapshot';

const FORMAT_OPTIONS: { id: ExportFormat; icon: typeof FileJsonIcon; ext: string; mime: string }[] =
  [
    { id: 'json', icon: FileJsonIcon, ext: 'json', mime: 'application/json' },
    { id: 'csv', icon: FileSpreadsheetIcon, ext: 'csv', mime: 'text/csv' },
    { id: 'markdown', icon: FileTextIcon, ext: 'md', mime: 'text/markdown' },
  ];

export function ImportExportPage() {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const { data: starredRepos, isLoading: starredReposLoading } = useStarredRepos();
  const { data: collections, isLoading: collectionsLoading } = useCollections();
  const { data: collectionRepos, isLoading: collectionReposLoading } = useCollectionRepos();
  const { data: memories, isLoading: memoriesLoading } = useMemoriesList();
  const importData = useImportUserData();
  const isLoading =
    starredReposLoading || collectionsLoading || collectionReposLoading || memoriesLoading;

  const snapshot = useMemo(
    (): ExportSnapshot =>
      buildExportSnapshot({
        starredRepos: starredRepos ?? [],
        collections: collections ?? [],
        collectionRepos: collectionRepos ?? [],
        memories: memories ?? [],
      }),
    [starredRepos, collections, collectionRepos, memories],
  );

  const hasData = (starredRepos?.length ?? 0) > 0;

  const handleDownload = (option: (typeof FORMAT_OPTIONS)[number]) => {
    const stamp = new Date().toISOString().slice(0, 10);
    const content = serializeExport(snapshot, option.id);
    downloadText(content, `asterism-export-${stamp}.${option.ext}`, option.mime);
  };

  const handleImportFile = async (file: File) => {
    if (importData.isPending) {
      return;
    }
    if (!file.name.endsWith('.json')) {
      toast.error(t('importExport.invalidFile'));
      return;
    }
    try {
      const raw = await file.text();
      const result = await importData.mutateAsync(raw);
      toast.success(t('importExport.importSuccess'), {
        description: t('importExport.importSummary', {
          collections: result.imported.collections,
          collectionRepos: result.imported.collectionRepos,
          memories: result.imported.memories,
        }),
      });
      if (result.skipped.length > 0) {
        toast.message(t('importExport.importSkipped'), {
          description: result.skipped.slice(0, 3).join('; '),
        });
      }
      if (result.errors.length > 0) {
        toast.error(t('importExport.importPartial'), {
          description: result.errors.slice(0, 3).join('; '),
        });
      }
    } catch (error) {
      const code = error instanceof Error ? error.message : 'UNKNOWN';
      toast.error(
        t(`importExport.errors.${code}`, { defaultValue: t('importExport.importFailed') }),
      );
    }
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files[0];
    if (file) {
      void handleImportFile(file);
    }
  };

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-6 overflow-y-auto">
      <PageHeader title={t('importExport.title')} description={t('importExport.subtitle')} />

      {isLoading ? (
        <LoadingRegion label={t('loading.importExport')}>
          <ImportExportContentSkeleton />
        </LoadingRegion>
      ) : !hasData ? (
        <EmptyState
          icon={DownloadIcon}
          title={t('importExport.emptyTitle')}
          description={t('importExport.emptyDescription')}
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <section className="overflow-hidden rounded-lg border bg-card">
            <div className="flex flex-col gap-1.5 border-b p-5">
              <h2 className="font-semibold text-base text-foreground">
                {t('importExport.exportTitle')}
              </h2>
              <p className="text-[13px] leading-5 text-muted-foreground">
                {t('importExport.exportDescription')}
              </p>
            </div>
            <div className="divide-y">
              {FORMAT_OPTIONS.map((option) => {
                const Icon = option.icon;
                const descriptionId = `export-format-${option.id}`;

                return (
                  <div
                    key={option.id}
                    className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-medium text-sm text-foreground">
                          {t(`importExport.format.${option.id}`)}
                        </h3>
                        <p
                          id={descriptionId}
                          className="mt-1 text-[13px] leading-5 text-muted-foreground"
                        >
                          {t(`importExport.formatDescription.${option.id}`)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant={option.id === 'json' ? 'default' : 'outline'}
                      size="sm"
                      className="w-full sm:w-auto"
                      aria-describedby={descriptionId}
                      onClick={() => handleDownload(option)}
                    >
                      <DownloadIcon className="size-4" />
                      {t('importExport.downloadFormat', {
                        format: t(`importExport.format.${option.id}`),
                      })}
                    </Button>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="flex flex-col gap-4 rounded-lg border bg-card p-5">
            <h2 className="font-semibold text-base text-foreground">
              {t('importExport.importTitle')}
            </h2>
            <p className="text-[13px] leading-5 text-muted-foreground">
              {t('importExport.importDescription')}
            </p>
            {/* 拖拽区交互不适合原生 button，按用户要求使用 div 承载 role=button */}
            {/* biome-ignore lint/a11y/useSemanticElements: 交互形态不适合原生 button，按用户要求使用 div */}
            <div
              role="button"
              tabIndex={importData.isPending ? -1 : 0}
              aria-disabled={importData.isPending}
              aria-busy={importData.isPending}
              className={`flex min-h-36 flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-sm transition-colors ${
                dragOver ? 'border-primary bg-accent' : 'border-border bg-muted/30'
              } ${importData.isPending ? 'cursor-wait opacity-70' : 'cursor-pointer'}`}
              onClick={() => {
                if (!importData.isPending) {
                  fileInputRef.current?.click();
                }
              }}
              onKeyDown={(event) => {
                if (!importData.isPending && (event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={(event) => {
                event.preventDefault();
                if (!importData.isPending) {
                  setDragOver(true);
                }
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              {importData.isPending ? (
                <LoaderCircleIcon className="size-8 animate-spin text-muted-foreground motion-reduce:animate-none" />
              ) : (
                <UploadIcon className="size-8 text-muted-foreground" />
              )}
              <span className="font-medium text-foreground">
                {importData.isPending
                  ? t('importExport.restoring')
                  : t('importExport.uploadPrompt')}
              </span>
              <span className="text-muted-foreground">{t('importExport.uploadHint')}</span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              disabled={importData.isPending}
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleImportFile(file);
                }
                event.target.value = '';
              }}
            />
          </section>
        </div>
      )}
    </div>
  );
}
