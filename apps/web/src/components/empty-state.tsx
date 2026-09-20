import type { ComponentType, ReactNode, SVGProps } from 'react';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-16 text-center">
      {Icon ? (
        <div className="flex size-16 items-center justify-center">
          <Icon className="size-12 text-muted-foreground/60" aria-hidden="true" />
        </div>
      ) : null}
      <div className="flex max-w-sm flex-col gap-2">
        <p className="font-semibold text-section-title text-foreground">{title}</p>
        {description ? <p className="text-body text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
