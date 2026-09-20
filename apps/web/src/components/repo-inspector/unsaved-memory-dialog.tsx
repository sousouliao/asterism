import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@asterism/ui';
import { useTranslation } from 'react-i18next';
import { useRepoInspector } from '../../contexts/repo-inspector-context';
import { PendingActionContent } from '../pending-action-content';

export function UnsavedMemoryDialog() {
  const { t } = useTranslation();
  const {
    confirmOpen,
    confirmPending,
    confirmError,
    saveAndContinue,
    discardAndContinue,
    continueEditing,
  } = useRepoInspector();
  return (
    <Dialog
      open={confirmOpen}
      onOpenChange={(open) => {
        if (!open && !confirmPending) continueEditing();
      }}
    >
      <DialogContent
        closeLabel={t('drawer.continueEditing')}
        closeDisabled={confirmPending}
        onEscapeKeyDown={(event) => {
          if (confirmPending) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (confirmPending) event.preventDefault();
        }}
      >
        <DialogHeader className="pr-10">
          <DialogTitle>{t('drawer.unsavedTitle')}</DialogTitle>
          <DialogDescription>{t('drawer.unsavedDescription')}</DialogDescription>
          {confirmError ? (
            <p role="alert" className="text-caption text-destructive">
              {t('drawer.memorySaveError')}
            </p>
          ) : null}
        </DialogHeader>
        <DialogFooter className="flex-col sm:justify-end">
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            disabled={confirmPending}
            onClick={discardAndContinue}
          >
            {t('drawer.discardAndContinue')}
          </Button>
          <Button
            size="sm"
            className="w-full sm:w-auto"
            disabled={confirmPending}
            aria-busy={confirmPending}
            onClick={saveAndContinue}
          >
            <PendingActionContent
              pending={confirmPending}
              idleLabel={t('drawer.saveAndContinue')}
              pendingLabel={t('common.saving')}
            />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
