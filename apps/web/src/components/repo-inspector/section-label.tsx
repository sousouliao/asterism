import { Button } from '@asterism/ui';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export function SectionLabel({ children }: { children: ReactNode }) {
  return <h3 className="font-semibold text-caption text-foreground">{children}</h3>;
}

export function WriteRecovery({
  message,
  pending,
  onRetry,
  onCancel,
}: {
  message: string;
  pending: boolean;
  onRetry: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center gap-2" role="alert">
      <p className="min-w-0 flex-1 text-caption text-destructive">{message}</p>
      <Button type="button" variant="ghost" size="xs" disabled={pending} onClick={onCancel}>
        {t('common.cancel')}
      </Button>
      <Button type="button" variant="outline" size="xs" disabled={pending} onClick={onRetry}>
        {t('common.retry')}
      </Button>
    </div>
  );
}
