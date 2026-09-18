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
import { PendingActionContent } from './pending-action-content';

/** 通用确认对话框，用于删除等破坏性操作。 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pending = false,
  errorMessage,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  pending?: boolean;
  errorMessage?: string;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!pending) {
          onOpenChange(nextOpen);
        }
      }}
    >
      <DialogContent closeLabel={t('common.close')} closeDisabled={pending}>
        <DialogHeader className="pr-10">
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
          {errorMessage ? (
            <p role="alert" className="text-caption text-destructive">
              {errorMessage}
            </p>
          ) : null}
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={pending}
            aria-busy={pending}
            onClick={onConfirm}
          >
            <PendingActionContent
              pending={pending}
              idleLabel={confirmLabel}
              pendingLabel={t('common.deleting')}
            />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
