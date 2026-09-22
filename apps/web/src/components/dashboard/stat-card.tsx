import { Card } from '@asterism/ui';
import type { LucideIcon } from 'lucide-react';

export function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  subtext?: string;
}) {
  return (
    <Card className="flex min-w-0 items-center gap-3.5 rounded-lg p-4 transition-colors hover:border-border/80">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-caption font-medium text-muted-foreground">{label}</p>
        <div className="flex items-baseline gap-2">
          <p className="font-semibold text-2xl text-foreground tabular-nums">{value}</p>
          {subtext ? (
            <span className="truncate text-caption text-muted-foreground">{subtext}</span>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
