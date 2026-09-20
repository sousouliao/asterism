'use client';

import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';
import { GlassRail, type GlassRailVariant } from './glass-rail';

type SegmentedControlDisplay = 'icon' | 'label' | 'icon-label';
type SegmentedControlSize = 'sm' | 'md';

type SegmentedControlOption<T extends string> = {
  value: T;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
};

type IndicatorState = {
  width: number;
  x: number;
  ready: boolean;
};

const INDICATOR_INSET = 4;

const sizeClasses: Record<SegmentedControlSize, string> = {
  sm: 'px-[14px] py-2 text-body leading-normal',
  md: 'px-[14px] py-2 text-body leading-normal',
};

const iconOnlySizeClasses: Record<SegmentedControlSize, string> = {
  sm: 'px-[14px] py-2 text-body leading-normal',
  md: 'px-[14px] py-2 text-body leading-normal',
};

function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  ariaLabel,
  size = 'sm',
  display = 'label',
  variant = 'glass',
  className,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly SegmentedControlOption<T>[];
  ariaLabel: string;
  size?: SegmentedControlSize;
  display?: SegmentedControlDisplay;
  variant?: GlassRailVariant;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<T, HTMLButtonElement>());
  const [indicator, setIndicator] = useState<IndicatorState>({ width: 0, x: 0, ready: false });
  const enabledOptions = options.filter((option) => !option.disabled);

  const updateIndicatorForItem = useCallback((item: HTMLButtonElement) => {
    const root = rootRef.current;

    if (!root) {
      setIndicator((current) => ({ ...current, ready: false }));
      return;
    }

    const rootRect = root.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();

    setIndicator({
      width: Math.round(itemRect.width),
      x: Math.max(0, Math.round(itemRect.left - rootRect.left - INDICATOR_INSET)),
      ready: true,
    });
  }, []);

  const updateIndicator = useCallback(() => {
    const item = itemRefs.current.get(value);

    if (!item) {
      setIndicator((current) => ({ ...current, ready: false }));
      return;
    }

    updateIndicatorForItem(item);
  }, [updateIndicatorForItem, value]);

  const activateValue = useCallback(
    (nextValue: T) => {
      const item = itemRefs.current.get(nextValue);
      if (item) {
        updateIndicatorForItem(item);
      }
      onValueChange(nextValue);
    },
    [onValueChange, updateIndicatorForItem],
  );

  const moveFocus = useCallback(
    (nextValue: T) => {
      activateValue(nextValue);
      window.requestAnimationFrame(() => itemRefs.current.get(nextValue)?.focus());
    },
    [activateValue],
  );

  useEffect(() => {
    const frame = requestAnimationFrame(updateIndicator);
    return () => cancelAnimationFrame(frame);
  }, [updateIndicator]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    const observer = new ResizeObserver(updateIndicator);
    observer.observe(root);
    for (const item of itemRefs.current.values()) {
      observer.observe(item);
    }

    return () => observer.disconnect();
  }, [updateIndicator]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (enabledOptions.length === 0) {
      return;
    }

    const currentIndex = enabledOptions.findIndex((option) => option.value === value);
    const index = currentIndex === -1 ? 0 : currentIndex;
    const selectOption = (nextIndex: number) => {
      const option = enabledOptions[nextIndex];
      if (option) {
        moveFocus(option.value);
      }
    };

    if (event.key === 'Home') {
      event.preventDefault();
      selectOption(0);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      selectOption(enabledOptions.length - 1);
      return;
    }

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      selectOption((index + 1) % enabledOptions.length);
      return;
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      selectOption((index - 1 + enabledOptions.length) % enabledOptions.length);
    }
  };

  return (
    <GlassRail
      ref={rootRef}
      role="group"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      variant={variant}
      className={cn('relative inline-flex w-fit items-center gap-2', className)}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute top-1 bottom-1 left-1 rounded-lg border border-[var(--glass-indicator-border)] shadow-[var(--glass-indicator-shadow)] [background:var(--glass-indicator-bg)] [transition:transform_240ms_var(--ease-out-quart),width_240ms_var(--ease-out-quart)] motion-reduce:transition-none',
          !indicator.ready && 'opacity-0',
        )}
        style={
          {
            width: `${indicator.width}px`,
            transform: `translateX(${indicator.x}px)`,
          } as CSSProperties
        }
      />
      {options.map((option) => {
        const selected = option.value === value;
        const iconOnly = display === 'icon';
        const showIcon = display !== 'label' && option.icon;
        const showLabel = display !== 'icon';

        return (
          <button
            key={option.value}
            data-slot="segmented-control-item"
            ref={(element) => {
              if (element) {
                itemRefs.current.set(option.value, element);
              } else {
                itemRefs.current.delete(option.value);
              }
            }}
            type="button"
            aria-pressed={selected}
            aria-label={iconOnly ? option.label : undefined}
            disabled={option.disabled}
            tabIndex={selected ? 0 : -1}
            onClick={() => activateValue(option.value)}
            className={cn(
              'relative z-10 inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] font-normal outline-none [transition:color_180ms_var(--ease-out-quart),transform_120ms_var(--ease-out-quart),filter_120ms_ease] disabled:pointer-events-none disabled:opacity-45 active:[filter:brightness(0.95)] active:[transform:translateY(1px)_scale(0.98)] motion-reduce:transform-none [&_svg]:size-[14px] [&_svg]:shrink-0 [&_svg]:[transition:opacity_180ms_var(--ease-out-quart),transform_180ms_var(--ease-out-quart)]',
              iconOnly ? iconOnlySizeClasses[size] : sizeClasses[size],
              selected
                ? 'font-medium text-[var(--glass-tab-active-text)] [&_svg]:[transform:scale(1)] [&_svg]:opacity-100'
                : 'text-[var(--glass-tab-inactive-text)] hover:text-[var(--glass-tab-active-text)] focus-visible:text-[var(--glass-tab-active-text)] [&_svg]:[transform:scale(0.92)] [&_svg]:opacity-[0.68]',
              'focus-visible:ring-2 focus-visible:ring-ring/50',
            )}
          >
            {showIcon ? option.icon : null}
            {showLabel ? <span>{option.label}</span> : null}
          </button>
        );
      })}
    </GlassRail>
  );
}

export type { SegmentedControlDisplay, SegmentedControlOption, SegmentedControlSize };
export { SegmentedControl };
