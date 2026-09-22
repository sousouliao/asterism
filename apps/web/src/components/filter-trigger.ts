/**
 * Browse 筛选栏所有 trigger（facet、更多筛选、排序）共享的几何与层级。
 * Button 与 Select 的默认内边距、gap、宽度都不同，各 trigger 再各自覆盖就会在同一行里
 * 出现宽窄与留白不一致，因此这里只保留一份定义。
 */
export const FILTER_TRIGGER_CLASS =
  'h-8 min-w-28 max-w-44 justify-start gap-1.5 rounded-lg border-[var(--glass-border)] px-2.5 font-normal text-caption shadow-none hover:bg-accent/70 data-[state=open]:bg-accent/70 data-[state=open]:text-accent-foreground aria-expanded:bg-accent/70 aria-expanded:text-accent-foreground';

export const FILTER_TRIGGER_ACTIVE_CLASS =
  'border-primary/30 bg-primary/5 hover:bg-primary/10 data-[state=open]:bg-primary/10 aria-expanded:bg-primary/10';

/** Trigger 文案左对齐并占据剩余空间，使尾部徽标 / 箭头始终贴右边缘。 */
export const FILTER_TRIGGER_LABEL_CLASS = 'min-w-0 flex-1 truncate text-start';

export const FILTER_TRIGGER_ICON_CLASS = 'size-4 shrink-0 text-muted-foreground';

export const FILTER_TRIGGER_CHEVRON_CLASS = 'size-4 shrink-0 text-muted-foreground opacity-50';

/** 更多筛选与集合的已启用数量徽标，两处必须同尺寸。 */
export const FILTER_TRIGGER_COUNT_CLASS = 'h-5 min-w-5 shrink-0 px-1.5';
