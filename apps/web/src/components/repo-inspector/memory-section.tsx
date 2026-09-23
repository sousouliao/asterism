import type { StarredRepoRecord } from '@asterism/db';
import { Button, cn, Skeleton, Textarea } from '@asterism/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRepoInspector } from '../../contexts/repo-inspector-context';
import { useMemory } from '../../data/use-memory';
import { formatRelativeTime } from '../../lib/format';
import { PendingActionContent } from '../pending-action-content';
import { SectionLabel } from './section-label';

export function MemorySection({ record }: { record: StarredRepoRecord }) {
  const { t, i18n } = useTranslation();
  const { data: memory, isLoading } = useMemory(record.repoId);
  const {
    memoryDraft,
    syncMemory,
    setWhySaved,
    setMemoryNote,
    setMemoryEditing,
    saveMemory,
    discardMemory,
    confirmPending,
  } = useRepoInspector();
  const [error, setError] = useState(false);

  useEffect(() => {
    if (memory !== undefined) {
      syncMemory(record.repoId, memory);
    }
  }, [memory, record.repoId, syncMemory]);

  if (isLoading || !memoryDraft || memoryDraft.repoId !== record.repoId) {
    return <Skeleton className="h-44 w-full" />;
  }
  const dirty =
    memoryDraft.whySaved !== memoryDraft.serverWhySaved ||
    memoryDraft.note !== memoryDraft.serverNote;
  const sourceCreatedAt = memory?.sourceCreatedAt ?? record.starredAt;
  const savedTime = formatRelativeTime(sourceCreatedAt, i18n.language);
  const whySavedId = `memory-why-saved-${record.repoId}`;
  const noteId = `memory-note-${record.repoId}`;

  return (
    <section className="flex min-w-0 flex-col gap-3 border-b pb-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <SectionLabel>{t('drawer.memory')}</SectionLabel>
          <p className="mt-1 text-micro text-muted-foreground">
            {savedTime
              ? t('drawer.savedFromGitHub', { time: savedTime })
              : t('drawer.savedFromGitHubWithoutTime')}
          </p>
        </div>
        {!memoryDraft.editing ? (
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-caption text-link max-md:-my-2 max-md:-mr-2 max-md:min-h-11 max-md:px-2"
            onClick={() => setMemoryEditing(true)}
          >
            {t('common.edit')}
          </Button>
        ) : null}
      </div>
      {memoryDraft.editing ? (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={whySavedId} className="font-medium text-caption text-foreground">
              {t('drawer.whySaved')}
            </label>
            <Textarea
              id={whySavedId}
              value={memoryDraft.whySaved}
              onChange={(event) => {
                setError(false);
                setWhySaved(event.target.value);
              }}
              placeholder={t('drawer.whySavedPlaceholder')}
              rows={3}
              disabled={confirmPending}
              className="min-h-20 rounded-md text-body"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={noteId} className="font-medium text-caption text-foreground">
              {t('drawer.note')}
            </label>
            <Textarea
              id={noteId}
              value={memoryDraft.note}
              onChange={(event) => {
                setError(false);
                setMemoryNote(event.target.value);
              }}
              placeholder={t('drawer.notePlaceholder')}
              rows={4}
              disabled={confirmPending}
              className="min-h-24 rounded-md text-body"
            />
          </div>
          {error ? (
            <p role="alert" className="text-caption text-destructive">
              {t('drawer.memorySaveError')}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={confirmPending}
              onClick={() => {
                discardMemory();
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!dirty || confirmPending}
              aria-busy={confirmPending}
              onClick={async () => {
                try {
                  await saveMemory();
                } catch {
                  setError(true);
                }
              }}
            >
              <PendingActionContent
                pending={confirmPending}
                idleLabel={t('drawer.saveMemory')}
                pendingLabel={t('common.saving')}
              />
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <p className="font-medium text-caption text-foreground">{t('drawer.whySaved')}</p>
            <p
              className={cn(
                'mt-1 whitespace-pre-wrap text-caption',
                memoryDraft.serverWhySaved ? 'text-foreground/90' : 'text-muted-foreground',
              )}
            >
              {memoryDraft.serverWhySaved || t('drawer.notRecordedYet')}
            </p>
          </div>
          <div>
            <p className="font-medium text-caption text-foreground">{t('drawer.note')}</p>
            <p
              className={cn(
                'mt-1 whitespace-pre-wrap text-caption',
                memoryDraft.serverNote ? 'text-foreground/90' : 'text-muted-foreground',
              )}
            >
              {memoryDraft.serverNote || t('drawer.noNoteYet')}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
