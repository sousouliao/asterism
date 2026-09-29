import { Badge, cn } from '@asterism/ui';
import { FolderIcon } from 'lucide-react';
import type { RepoContextItem } from './repo-card-context';

export function ContextChip({ item, className }: { item: RepoContextItem; className?: string }) {
  if (item.kind === 'collection') {
    return (
      <Badge
        variant="secondary"
        className={cn('h-[22px] font-normal gap-1 leading-none', className)}
      >
        <FolderIcon className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="leading-none">{item.label}</span>
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className={cn('h-[22px] font-normal leading-none', className)}>
      <span className="leading-none">{item.label}</span>
    </Badge>
  );
}
