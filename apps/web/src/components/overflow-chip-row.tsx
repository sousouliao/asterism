import { cn, Tooltip, TooltipContent, TooltipTrigger } from '@asterism/ui';
import type { ReactNode } from 'react';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

const CHIP_GAP_PX = 6;

export function calculateOverflowChipLayout({
  containerWidth,
  itemWidths,
  overflowWidths,
  gapWidth = CHIP_GAP_PX,
}: {
  containerWidth: number;
  itemWidths: readonly number[];
  overflowWidths: ReadonlyMap<number, number>;
  gapWidth?: number;
}): { visibleCount: number; overflowCount: number } {
  const totalItems = itemWidths.length;

  if (totalItems === 0) {
    return { visibleCount: 0, overflowCount: 0 };
  }

  const widthFor = (visibleCount: number) => {
    const overflowCount = totalItems - visibleCount;
    const visibleWidth = itemWidths.slice(0, visibleCount).reduce((sum, width) => sum + width, 0);
    const overflowWidth = overflowCount > 0 ? (overflowWidths.get(overflowCount) ?? 0) : 0;
    const renderedCount = visibleCount + (overflowCount > 0 ? 1 : 0);
    const gapWidthTotal = renderedCount > 1 ? (renderedCount - 1) * gapWidth : 0;

    return visibleWidth + overflowWidth + gapWidthTotal;
  };

  if (widthFor(totalItems) <= containerWidth) {
    return { visibleCount: totalItems, overflowCount: 0 };
  }

  for (let visibleCount = totalItems - 1; visibleCount >= 0; visibleCount -= 1) {
    if (widthFor(visibleCount) <= containerWidth) {
      return { visibleCount, overflowCount: totalItems - visibleCount };
    }
  }

  return { visibleCount: 0, overflowCount: totalItems };
}

export function OverflowChipRow<T>({
  items,
  getKey,
  getItemLabel,
  renderChip,
  renderOverflowChip,
  renderTooltipItem,
  overflowLabel,
  className,
}: {
  items: readonly T[];
  getKey: (item: T) => string;
  getItemLabel: (item: T) => string;
  renderChip: (item: T) => ReactNode;
  renderOverflowChip: (overflowCount: number) => ReactNode;
  renderTooltipItem?: (item: T) => ReactNode;
  overflowLabel: (overflowCount: number) => string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measurementRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLSpanElement>());
  const overflowRefs = useRef(new Map<number, HTMLSpanElement>());
  const [visibleCount, setVisibleCount] = useState(items.length);

  const updateVisibleCount = useCallback(() => {
    const container = containerRef.current;
    if (!container || items.length === 0) {
      setVisibleCount(items.length);
      return;
    }

    const itemWidths = items.map((item) => itemRefs.current.get(getKey(item))?.offsetWidth ?? 0);
    const overflowWidths = new Map<number, number>();

    for (let count = 1; count <= items.length; count += 1) {
      overflowWidths.set(count, overflowRefs.current.get(count)?.offsetWidth ?? 0);
    }

    const next = calculateOverflowChipLayout({
      containerWidth: container.clientWidth,
      itemWidths,
      overflowWidths,
    });

    setVisibleCount(next.visibleCount);
  }, [getKey, items]);

  useLayoutEffect(() => {
    updateVisibleCount();
  }, [updateVisibleCount]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measurement = measurementRef.current;
    if (!container) {
      return;
    }

    const observer = new ResizeObserver(updateVisibleCount);
    observer.observe(container);
    if (measurement) {
      observer.observe(measurement);
    }

    return () => observer.disconnect();
  }, [updateVisibleCount]);

  const visibleItems = items.slice(0, visibleCount);
  const overflowItems = items.slice(visibleCount);
  const overflowCount = overflowItems.length;

  return (
    <div ref={containerRef} className={cn('relative min-w-0', className)}>
      <div className="flex min-w-0 flex-nowrap items-center gap-1.5 overflow-hidden">
        {visibleItems.map((item) => (
          <span key={getKey(item)} className="inline-flex shrink-0 items-center">
            {renderChip(item)}
          </span>
        ))}
        {overflowCount > 0 ? (
          <span className="inline-flex shrink-0 items-center">
            <Tooltip>
              <TooltipTrigger asChild>
                {/* 按需求用 div 承载 tooltip 触发器（shadcn Button 不适用），以 role=button 保留可访问性 */}
                {/* biome-ignore lint/a11y/useSemanticElements: 交互形态不适合原生 button，按用户要求使用 div */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={overflowLabel(overflowCount)}
                  className="inline-flex cursor-default bg-transparent p-0 leading-none text-inherit"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  {renderOverflowChip(overflowCount)}
                </div>
              </TooltipTrigger>
              <TooltipContent sideOffset={6} className="max-w-64 p-2 text-left">
                <div className="flex max-w-64 flex-wrap gap-1.5">
                  {overflowItems.map((item) => (
                    <span key={getKey(item)} className="inline-flex shrink-0 items-center">
                      {renderTooltipItem ? (
                        renderTooltipItem(item)
                      ) : (
                        <span className="rounded-sm bg-secondary px-2 py-0.5 text-caption text-secondary-foreground">
                          {getItemLabel(item)}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          </span>
        ) : null}
      </div>

      <div
        ref={measurementRef}
        aria-hidden="true"
        className="invisible pointer-events-none absolute top-0 left-0 flex h-0 max-w-none flex-nowrap items-center gap-1.5 overflow-hidden whitespace-nowrap"
      >
        {items.map((item) => (
          <span
            key={getKey(item)}
            ref={(element) => {
              if (element) {
                itemRefs.current.set(getKey(item), element);
              } else {
                itemRefs.current.delete(getKey(item));
              }
            }}
            className="inline-flex shrink-0 items-center"
          >
            {renderChip(item)}
          </span>
        ))}
        {Array.from({ length: items.length }, (_, index) => index + 1).map((count) => (
          <span
            key={count}
            ref={(element) => {
              if (element) {
                overflowRefs.current.set(count, element);
              } else {
                overflowRefs.current.delete(count);
              }
            }}
            className="inline-flex shrink-0 items-center"
          >
            {renderOverflowChip(count)}
          </span>
        ))}
      </div>
    </div>
  );
}
