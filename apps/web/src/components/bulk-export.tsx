import type { CollectionRepoLink, CollectionWithMeta, StarredRepoRecord } from '@asterism/db';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@asterism/ui';
import {
  DownloadIcon,
  FileJsonIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  LoaderCircleIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { downloadText, type ExportFormat, serializeExport } from '../data/use-import-export';
import { useMemoriesList } from '../data/use-memories-list';
import { buildSelectedExportSnapshot } from '../lib/export-snapshot';

const FORMAT_OPTIONS: { id: ExportFormat; icon: typeof FileJsonIcon; ext: string; mime: string }[] =
  [
    { id: 'json', icon: FileJsonIcon, ext: 'json', mime: 'application/json' },
    { id: 'csv', icon: FileSpreadsheetIcon, ext: 'csv', mime: 'text/csv' },
    { id: 'markdown', icon: FileTextIcon, ext: 'md', mime: 'text/markdown' },
  ];

/** 导出固定选择范围的对话框：只读地读取最新数据，失败时保留选择并原地重试。 */
export function BulkExportDialog({
  open,
  onOpenChange,
  selectedRepoIds,
  starredRepos,
  collections,
  collectionRepos,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedRepoIds: ReadonlySet<string>;
  starredRepos: StarredRepoRecord[];
  collections: CollectionWithMeta[];
  collectionRepos: CollectionRepoLink[];
}) {
  const { t } = useTranslation();
  const memories = useMemoriesList({ enabled: open });
  const [downloadFailed, setDownloadFailed] = useState(false);

  useEffect(() => {
    if (open) {
      setDownloadFailed(false);
    }
  }, [open]);

  const snapshot = useMemo(
    () =>
      buildSelectedExportSnapshot(
        { starredRepos, collections, collectionRepos, memories: memories.data ?? [] },
        selectedRepoIds,
      ),
    [starredRepos, collections, collectionRepos, memories.data, selectedRepoIds],
  );
  const repoCount = snapshot.repos.length;

  const memoriesPending = open && memories.isLoading;
  const hasError = downloadFailed || (open && memories.isError);

  const handleDownload = (option: (typeof FORMAT_OPTIONS)[number]) => {
    try {
      setDownloadFailed(false);
      const stamp = new Date().toISOString().slice(0, 10);
      const content = serializeExport(snapshot, option.id);
      downloadText(content, `asterism-selection-${stamp}.${option.ext}`, option.mime);
    } catch {
      setDownloadFailed(true);
    }
  };

  const handleRetry = () => {
    setDownloadFailed(false);
    if (memories.isError) {
      void memories.refetch();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] sm:max-w-[36rem]">
        <DialogHeader className="pr-10">
          <DialogTitle>{t('bulk.export.title')}</DialogTitle>
          <DialogDescription>
            {t('bulk.export.description', { count: repoCount })}
          </DialogDescription>
          {hasError ? (
            <p role="alert" className="text-caption text-destructive">
              {t('bulk.export.error')}
            </p>
          ) : null}
        </DialogHeader>
        <div className="min-h-0 divide-y overflow-y-auto rounded-lg border bg-card">
          {FORMAT_OPTIONS.map((option) => {
            const Icon = option.icon;
            const descriptionId = `bulk-export-format-${option.id}`;

            return (
              <div key={option.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-medium text-body text-foreground">
                      {t(`importExport.format.${option.id}`)}
                    </h3>
                    <p id={descriptionId} className="mt-1 text-caption text-muted-foreground">
                      {t(`bulk.export.formatDescription.${option.id}`)}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant={option.id === 'json' ? 'default' : 'outline'}
                  size="sm"
                  className="w-full sm:w-auto"
                  aria-describedby={descriptionId}
                  disabled={memoriesPending || repoCount === 0}
                  onClick={() => handleDownload(option)}
                >
                  {memoriesPending ? (
                    <LoaderCircleIcon className="size-4 animate-spin motion-reduce:animate-none" />
                  ) : (
                    <DownloadIcon className="size-4" />
                  )}
                  {t('bulk.export.download', { format: t(`importExport.format.${option.id}`) })}
                </Button>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          {hasError ? (
            <Button type="button" variant="outline" size="sm" onClick={handleRetry}>
              {t('bulk.export.retry')}
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
