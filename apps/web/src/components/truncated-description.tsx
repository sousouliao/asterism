import { Tooltip, TooltipContent, TooltipTrigger } from '@asterism/ui';
import type { KeyboardEvent } from 'react';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

type ElementMeasurements = Pick<
  HTMLElement,
  'clientHeight' | 'clientWidth' | 'scrollHeight' | 'scrollWidth'
>;

export function isTextTruncated(element: ElementMeasurements): boolean {
  return element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth;
}

export function TruncatedDescription({
  children,
  onSelect,
}: {
  children: string;
  onSelect?: () => void;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [truncated, setTruncated] = useState(false);

  const measure = useCallback(() => {
    const element = ref.current;
    setTruncated(element ? isTextTruncated(element) : false);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: text can change scroll size without changing the observed box
  useLayoutEffect(() => {
    measure();
    const element = ref.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [children, measure]);

  const handleKeyDown = (event: KeyboardEvent<HTMLParagraphElement>) => {
    if (onSelect && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onSelect();
    }
  };

  const description = (
    <p
      ref={ref}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={onSelect ? handleKeyDown : undefined}
      className="pointer-events-auto line-clamp-2 rounded-sm text-body text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </p>
  );

  if (!truncated) {
    return description;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{description}</TooltipTrigger>
      <TooltipContent
        side="top"
        align="start"
        sideOffset={6}
        className="max-w-96 text-left leading-5"
      >
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
