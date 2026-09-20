export const TRIGGER_ATTRIBUTE = 'data-repo-quick-look-trigger';
export const FLOATING_MARGIN = 12;

export type FloatingPosition = { left: number; top: number };

export type DragState = {
  active: boolean;
  pointerId: number;
  surface: HTMLDivElement;
  pointerX: number;
  pointerY: number;
  originLeft: number;
  originTop: number;
  next: FloatingPosition;
};

/** Portaled overlays (Radix menu / dialog) live outside the Quick Look panel DOM. */
export function isPortaledOverlayTarget(target: Element | null): boolean {
  return Boolean(
    target?.closest('[role="menu"], [role="listbox"], [role="dialog"]:not(#repo-inspector)'),
  );
}

export function clampFloatingPosition(
  left: number,
  top: number,
  width: number,
  height: number,
): FloatingPosition {
  return {
    left: Math.min(
      Math.max(left, FLOATING_MARGIN),
      Math.max(FLOATING_MARGIN, window.innerWidth - width - FLOATING_MARGIN),
    ),
    top: Math.min(
      Math.max(top, FLOATING_MARGIN),
      Math.max(FLOATING_MARGIN, window.innerHeight - height - FLOATING_MARGIN),
    ),
  };
}

export function setFloatingPosition(frame: HTMLDivElement, position: FloatingPosition) {
  Object.assign(frame.style, {
    bottom: 'auto',
    left: `${position.left}px`,
    right: 'auto',
    top: `${position.top}px`,
    transform: 'none',
  });
}

export function visibleTrigger(repoId: string): HTMLElement | null {
  const selector = `[${TRIGGER_ATTRIBUTE}="${CSS.escape(repoId)}"]`;
  for (const element of document.querySelectorAll<HTMLElement>(selector)) {
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return element;
    }
  }
  return null;
}

export function sourceTransform(source: HTMLElement | null, target: HTMLElement): string {
  if (!source) {
    return 'none';
  }
  const sourceRect = source.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const x = sourceRect.left + sourceRect.width / 2 - (targetRect.left + targetRect.width / 2);
  const y = sourceRect.top + sourceRect.height / 2 - (targetRect.top + targetRect.height / 2);
  return `translate3d(${x}px, ${y}px, 0) scale(0.96)`;
}
