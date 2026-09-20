import { cn } from '@asterism/ui';
import { RefreshCwIcon } from 'lucide-react';

export function SyncProgressBanner({ label, className }: { label: string; className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex items-center gap-3 rounded-lg border bg-card p-4', className)}
    >
      <RefreshCwIcon
        className="size-5 shrink-0 animate-spin text-link motion-reduce:animate-none"
        aria-hidden="true"
      />
      <p className="font-medium text-body text-foreground">{label}</p>
    </div>
  );
}
