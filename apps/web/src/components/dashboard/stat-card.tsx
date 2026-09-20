import type { LucideIcon } from 'lucide-react';

export function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 px-4 py-4">
      <Icon className="size-5 shrink-0 text-link" />
      <div className="min-w-0">
        <p className="text-body text-muted-foreground">{label}</p>
        <p className="font-semibold text-2xl text-foreground tabular-nums">{value}</p>
      </div>
    </div>
  );
}
