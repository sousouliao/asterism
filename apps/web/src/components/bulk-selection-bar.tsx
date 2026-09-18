import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@asterism/ui';
import { CheckIcon, ListChecksIcon, MoreHorizontalIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function BulkSelectionBar({
  selectedCount,
  hiddenSelectedCount,
  scopeActionKey,
  scopeCount,
  scopeActionDisabled,
  hasSelection,
  hasActiveBulkOperation,
  onScopeAction,
  onOrganize,
  onExport,
  onClear,
  onDone,
}: {
  selectedCount: string;
  hiddenSelectedCount?: string;
  scopeActionKey:
    | 'bulk.selectAll'
    | 'bulk.selectAllFiltered'
    | 'bulk.addAll'
    | 'bulk.addAllFiltered'
    | 'bulk.deselectAll'
    | 'bulk.deselectAllFiltered';
  scopeCount: string;
  scopeActionDisabled: boolean;
  hasSelection: boolean;
  hasActiveBulkOperation: boolean;
  onScopeAction: () => void;
  onOrganize: () => void;
  onExport: () => void;
  onClear: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 lg:left-60">
      <div className="mx-auto max-w-6xl pl-6 pr-[calc(var(--scrollbar-size)_+_1.5rem)] pb-4">
        <section
          aria-label={t('bulk.toolbarLabel')}
          className="asterism-glass-overlay pointer-events-auto flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="inline-flex items-center gap-1.5 font-medium text-caption text-foreground">
              <ListChecksIcon className="size-4 text-primary" aria-hidden="true" />
              {t('bulk.modeTitle')}
            </span>
            <span
              aria-live="polite"
              className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-caption text-primary"
            >
              {t('bulk.selectedCount', { count: selectedCount })}
            </span>
            {hiddenSelectedCount ? (
              <span className="text-caption text-muted-foreground">
                {t('bulk.hiddenSelectedCount', { count: hiddenSelectedCount })}
              </span>
            ) : null}
          </div>

          <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:justify-end">
            <Button
              variant={hasSelection ? 'outline' : 'default'}
              size="sm"
              disabled={scopeActionDisabled}
              onClick={onScopeAction}
            >
              {t(scopeActionKey, { count: scopeCount })}
            </Button>
            {hasSelection ? (
              <Button size="sm" disabled={hasActiveBulkOperation} onClick={onOrganize}>
                {t('bulk.organize')}
              </Button>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" aria-label={t('bulk.moreActions')}>
                  <MoreHorizontalIcon className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled={!hasSelection} onSelect={onExport}>
                  {t('bulk.export.action')}
                </DropdownMenuItem>
                <DropdownMenuItem disabled={!hasSelection} onSelect={onClear}>
                  {t('bulk.clear')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={onDone}>
              <CheckIcon className="size-4" aria-hidden="true" />
              {t('common.done')}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
