import type { ReactNode } from 'react';

/**
 * 页内区块标题簇：标题 + 可选徽章 / 说明 / 主操作。
 * 间距遵循 ui-ux 标题簇：标题↔说明 xs（gap-1），与 PageHeader 同一节奏。
 */
export function SectionHeader({
  title,
  description,
  badge,
  actions,
  titleId,
}: {
  title: string;
  description?: string;
  badge?: ReactNode;
  actions?: ReactNode;
  titleId?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id={titleId} className="font-semibold text-section-title text-foreground">
            {title}
          </h2>
          {badge}
        </div>
        {description ? <p className="text-body text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
