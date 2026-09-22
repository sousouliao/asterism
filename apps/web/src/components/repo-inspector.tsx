import { repoFullName } from '@asterism/core';
import type { StarredRepoRecord } from '@asterism/db';
import {
  Button,
  cn,
  Sheet,
  SheetContent,
  SheetTitle,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@asterism/ui';
import {
  ArchiveIcon,
  BookOpenIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  GitForkIcon,
  StarIcon,
  XIcon,
} from 'lucide-react';
import {
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useRepoInspector } from '../contexts/repo-inspector-context';
import { useMediaQuery } from '../hooks/use-media-query';
import { formatCompactNumber, formatCompactRelativeTime, formatRelativeTime } from '../lib/format';
import { languageColor } from '../lib/language-colors';
import { createBrowseSourceSnapshot, createReadmeDestination } from '../lib/readme-navigation';
import { rememberReadmeEntry } from '../lib/readme-return-coordinator';
import {
  measureElementRect,
  planReverseWorkspaceMotion,
  runWorkspaceFrameAnimation,
  WORKSPACE_MOTION_EASING,
} from '../lib/readme-workspace-motion';
import {
  armForwardWorkspaceMotion,
  consumeWorkspaceMotion,
  peekPendingWorkspaceMotion,
  recordWorkspaceMotionMode,
} from '../lib/readme-workspace-motion-store';
import { useBrowseFilters } from '../stores/browse-filters';
import { getBrowseView } from '../stores/browse-view';
import { useListScrollStore } from '../stores/list-scroll';
import { adjacentRepo, findRepoIndex, useRepoInspectorStore } from '../stores/repo-inspector';
import { CollectionsSection } from './repo-inspector/collections-section';
import {
  clampFloatingPosition,
  type DragState,
  type FloatingPosition,
  isPortaledOverlayTarget,
  setFloatingPosition,
  sourceTransform,
  TRIGGER_ATTRIBUTE,
  visibleTrigger,
} from './repo-inspector/floating-frame';
import { MemorySection } from './repo-inspector/memory-section';
import { RelatedStarsSection } from './repo-inspector/related-stars-section';
import { UnsavedMemoryDialog } from './repo-inspector/unsaved-memory-dialog';

function ControlButton({
  label,
  children,
  tooltip = true,
  ...props
}: {
  label: string;
  children: ReactNode;
  tooltip?: boolean;
} & React.ComponentProps<typeof Button>) {
  const button = (
    <Button type="button" variant="ghost" size="icon-sm" aria-label={label} {...props}>
      {children}
    </Button>
  );

  return tooltip ? (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent sideOffset={6}>{label}</TooltipContent>
    </Tooltip>
  ) : (
    button
  );
}

export function RepoInspector() {
  const { t } = useTranslation();
  const floating = useMediaQuery('(min-width: 768px)');
  const record = useRepoInspectorStore((state) => state.record);
  const context = useRepoInspectorStore((state) => state.context);
  const {
    requestNavigate,
    requestClose,
    requestRoute,
    dirty,
    confirmOpen,
    openModality,
    closeSignal,
  } = useRepoInspector();
  const index = findRepoIndex(context, record?.repoId);
  const previous = adjacentRepo(context, record?.repoId, -1);
  const next = adjacentRepo(context, record?.repoId, 1);
  const readReadme = useCallback(() => {
    if (!record) return;
    const sourcePath = context?.sourceKey.startsWith('collection:')
      ? `/collections/${context.sourceKey.slice('collection:'.length)}`
      : '/';
    const scrollTop = useListScrollStore.getState().getScrollTop(context?.sourceKey ?? 'browse');
    const filters = useBrowseFilters.getState();
    const destination = createReadmeDestination(
      record.repo.owner,
      record.repo.name,
      record.repoId,
      sourcePath,
      context?.sourceKey.startsWith('collection:')
        ? { collectionName: context.sourceName, scrollTop }
        : {
            browseSnapshot: createBrowseSourceSnapshot(
              {
                query: filters.query,
                language: filters.language,
                topic: filters.topic,
                collectionIds: filters.collectionIds,
                minStars: filters.minStars,
                pushedWithinDays: filters.pushedWithinDays,
                status: filters.status,
                sort: filters.sort,
              },
              getBrowseView(),
              scrollTop,
            ),
          },
    );
    rememberReadmeEntry(destination.state.readme);
    // Mobile Sheet (and any non-floating path) arms a non-spatial crossfade intent.
    if (!floating) {
      armForwardWorkspaceMotion({
        direction: 'forward',
        repoId: record.repoId,
        sourceRect: { left: 0, top: 0, width: 1, height: 1 },
        floatingQuickLook: false,
      });
    }
    requestRoute(destination.to, destination.state);
  }, [context?.sourceKey, context?.sourceName, floating, record, requestRoute]);

  useEffect(() => {
    if (!record || floating) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as Element | null;
      if (
        target?.closest('input, textarea, select, [contenteditable="true"]') ||
        isPortaledOverlayTarget(target)
      ) {
        return;
      }
      if (event.key.toLowerCase() === 'j' && next) {
        event.preventDefault();
        requestNavigate(1);
      } else if (event.key.toLowerCase() === 'k' && previous) {
        event.preventDefault();
        requestNavigate(-1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [floating, next, previous, record, requestNavigate]);

  const handledMobileCloseSignal = useRef(closeSignal);
  useEffect(() => {
    if (floating || !record || handledMobileCloseSignal.current === closeSignal) return;
    handledMobileCloseSignal.current = closeSignal;
    requestClose();
  }, [closeSignal, floating, record, requestClose]);

  if (floating) {
    return record
      ? createPortal(
          <FloatingQuickLook
            record={record}
            index={index}
            total={context?.records.length ?? 0}
            hasPrevious={Boolean(previous)}
            hasNext={Boolean(next)}
            dirty={dirty}
            confirmOpen={confirmOpen}
            openModality={openModality}
            closeSignal={closeSignal}
            onPrevious={() => requestNavigate(-1)}
            onNext={() => requestNavigate(1)}
            onReadReadme={readReadme}
            onClose={requestClose}
          />,
          document.body,
        )
      : null;
  }

  return (
    <Sheet
      open={Boolean(record)}
      onOpenChange={(open) => {
        if (!open) {
          requestClose();
        }
      }}
    >
      <SheetContent
        id="repo-inspector"
        side="bottom"
        className="@container/inspector max-h-[min(90svh,52rem)] gap-0 overflow-y-auto rounded-t-lg border-x border-t p-0 [&>button.absolute]:hidden"
      >
        <SheetTitle className="sr-only">{t('drawer.title')}</SheetTitle>
        {record ? (
          <InspectorBody
            record={record}
            mobile
            index={index}
            total={context?.records.length ?? 0}
            hasPrevious={Boolean(previous)}
            hasNext={Boolean(next)}
            onPrevious={() => requestNavigate(-1)}
            onNext={() => requestNavigate(1)}
            onReadReadme={readReadme}
            onClose={requestClose}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function FloatingQuickLook({
  record,
  index,
  total,
  hasPrevious,
  hasNext,
  dirty,
  confirmOpen,
  openModality,
  closeSignal,
  onPrevious,
  onNext,
  onReadReadme,
  onClose,
}: {
  record: StarredRepoRecord;
  index: number;
  total: number;
  hasPrevious: boolean;
  hasNext: boolean;
  dirty: boolean;
  confirmOpen: boolean;
  openModality: 'keyboard' | 'pointer';
  closeSignal: number;
  onPrevious: () => void;
  onNext: () => void;
  onReadReadme: () => void;
  onClose: () => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const closingRef = useRef(false);
  const positionRef = useRef<FloatingPosition | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressDragClickRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const currentRepoId = useRef(record.repoId);
  const handledCloseSignal = useRef(closeSignal);
  currentRepoId.current = record.repoId;

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const source = visibleTrigger(currentRepoId.current);
    returnFocusRef.current = source;

    const pending = peekPendingWorkspaceMotion();
    if (pending?.direction === 'reverse' && pending.repoId === currentRepoId.current) {
      const consumed = consumeWorkspaceMotion('reverse');
      if (consumed?.direction === 'reverse') {
        const targetRect = measureElementRect(panel);
        const mode = planReverseWorkspaceMotion({
          reducedMotion,
          sourceRestored: true,
          sameRepo: true,
          triggerVisible: Boolean(source),
          quickLookVisible: Boolean(targetRect),
          sourceRect: consumed.sourceRect,
          targetRect,
        });
        recordWorkspaceMotionMode(mode);
        panel.dataset.workspaceMotion = mode;
        if (mode === 'contract' && targetRect) {
          void runWorkspaceFrameAnimation({
            element: panel,
            mode,
            from: consumed.sourceRect,
            to: targetRect,
          });
        } else if (mode === 'crossfade' && typeof panel.animate === 'function') {
          const fade = panel.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: 120,
            easing: WORKSPACE_MOTION_EASING,
          });
          void fade.finished.catch(() => undefined);
        }
        if (openModality === 'keyboard') {
          panel.focus({ preventScroll: true });
        }
        return;
      }
    }

    if (!reducedMotion) {
      panel.animate(
        [
          { opacity: 0, transform: sourceTransform(source, panel) },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 220, easing: WORKSPACE_MOTION_EASING },
      );
    }
    if (openModality === 'keyboard') {
      panel.focus({ preventScroll: true });
    }
  }, [openModality, reducedMotion]);

  const handleReadReadme = useCallback(() => {
    const rect = measureElementRect(frameRef.current) ?? measureElementRect(panelRef.current);
    armForwardWorkspaceMotion({
      direction: 'forward',
      repoId: record.repoId,
      sourceRect: rect ?? { left: 0, top: 0, width: 1, height: 1 },
      floatingQuickLook: Boolean(rect),
    });
    onReadReadme();
  }, [onReadReadme, record.repoId]);

  const close = useCallback(async () => {
    if (closingRef.current || confirmOpen) return;
    if (dirty) {
      onClose();
      return;
    }
    closingRef.current = true;
    const panel = panelRef.current;
    const source = visibleTrigger(currentRepoId.current) ?? returnFocusRef.current;
    if (panel && !reducedMotion) {
      const animation = panel.animate(
        [
          { opacity: 1, transform: 'none' },
          { opacity: 0, transform: sourceTransform(source, panel) },
        ],
        { duration: 220, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' },
      );
      await animation.finished.catch(() => undefined);
    }
    onClose();
    queueMicrotask(() => source?.focus({ preventScroll: true }));
  }, [confirmOpen, dirty, onClose, reducedMotion]);

  useEffect(() => {
    if (handledCloseSignal.current === closeSignal) return;
    handledCloseSignal.current = closeSignal;
    void close();
  }, [close, closeSignal]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      const link = target?.closest<HTMLAnchorElement>('a[href]');
      const followsInternalRoute =
        link && link.origin === window.location.origin && link.target !== '_blank';
      if (
        confirmOpen ||
        panelRef.current?.contains(target) ||
        target?.closest(`[${TRIGGER_ATTRIBUTE}]`) ||
        isPortaledOverlayTarget(target) ||
        followsInternalRoute
      ) {
        return;
      }
      void close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as Element | null;
      if (
        target?.closest('input, textarea, select, [contenteditable="true"]') ||
        isPortaledOverlayTarget(target)
      ) {
        return;
      }
      if (event.key.toLowerCase() === 'j' && hasNext) {
        event.preventDefault();
        onNext();
      } else if (event.key.toLowerCase() === 'k' && hasPrevious) {
        event.preventDefault();
        onPrevious();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        void close();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [close, confirmOpen, hasNext, hasPrevious, onNext, onPrevious]);

  const beginDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as Element;
    if (target.closest('[data-window-control]')) return;
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    const origin = { left: rect.left, top: rect.top };
    setFloatingPosition(frame, origin);
    positionRef.current = origin;
    dragRef.current = {
      active: false,
      pointerId: event.pointerId,
      surface: event.currentTarget,
      pointerX: event.clientX,
      pointerY: event.clientY,
      originLeft: origin.left,
      originTop: origin.top,
      next: origin,
    };
  }, []);

  const moveDrag = useCallback((event: PointerEvent) => {
    const drag = dragRef.current;
    const frame = frameRef.current;
    if (!drag || !frame || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.pointerX;
    const deltaY = event.clientY - drag.pointerY;
    if (!drag.active && Math.hypot(deltaX, deltaY) < 4) return;
    if (!drag.active) {
      drag.active = true;
      drag.surface.setPointerCapture(event.pointerId);
      setDragging(true);
    }
    event.preventDefault();
    const rect = frame.getBoundingClientRect();
    const next = clampFloatingPosition(
      drag.originLeft + deltaX,
      drag.originTop + deltaY,
      rect.width,
      rect.height,
    );
    drag.next = next;
    frame.style.transform = `translate3d(${next.left - drag.originLeft}px, ${next.top - drag.originTop}px, 0)`;
  }, []);

  const endDrag = useCallback((event: PointerEvent) => {
    const drag = dragRef.current;
    const frame = frameRef.current;
    if (!drag || !frame || drag.pointerId !== event.pointerId) return;
    setFloatingPosition(frame, drag.next);
    positionRef.current = drag.next;
    suppressDragClickRef.current = drag.active && event.type === 'pointerup';
    dragRef.current = null;
    if (drag.surface.hasPointerCapture(event.pointerId)) {
      drag.surface.releasePointerCapture(event.pointerId);
    }
    if (drag.active) setDragging(false);
  }, []);

  const suppressClickAfterDrag = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!suppressDragClickRef.current) return;
    suppressDragClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  useEffect(() => {
    window.addEventListener('pointermove', moveDrag, { passive: false });
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    return () => {
      window.removeEventListener('pointermove', moveDrag);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
    };
  }, [endDrag, moveDrag]);

  useEffect(() => {
    const keepInViewport = () => {
      const frame = frameRef.current;
      const position = positionRef.current;
      if (!frame || !position) return;
      const rect = frame.getBoundingClientRect();
      const next = clampFloatingPosition(position.left, position.top, rect.width, rect.height);
      setFloatingPosition(frame, next);
      positionRef.current = next;
    };
    window.addEventListener('resize', keepInViewport);
    return () => window.removeEventListener('resize', keepInViewport);
  }, []);

  return (
    <div
      ref={frameRef}
      data-quick-look-frame
      className="pointer-events-none fixed right-6 bottom-6 left-auto z-50 w-[min(30rem,calc(100vw-2rem))] translate-x-0"
    >
      <div
        ref={panelRef}
        id="repo-inspector"
        role="dialog"
        aria-modal="false"
        aria-labelledby="repo-quick-look-title"
        tabIndex={-1}
        className="asterism-glass-overlay @container/inspector pointer-events-auto overflow-hidden rounded-xl border text-popover-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <InspectorBody
          record={record}
          index={index}
          total={total}
          hasPrevious={hasPrevious}
          hasNext={hasNext}
          onPrevious={onPrevious}
          onNext={onNext}
          onReadReadme={handleReadReadme}
          onClose={() => void close()}
          dragSurface={{
            dragging,
            onClickCapture: suppressClickAfterDrag,
            onPointerDown: beginDrag,
          }}
        />
      </div>
    </div>
  );
}

function InspectorBody({
  record,
  mobile = false,
  index,
  total,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  onReadReadme,
  onClose,
  dragSurface,
}: {
  record: StarredRepoRecord;
  mobile?: boolean;
  index: number;
  total: number;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onReadReadme: () => void;
  onClose: () => void;
  dragSurface?: {
    dragging: boolean;
    onClickCapture: React.ComponentProps<'div'>['onClickCapture'];
    onPointerDown: React.ComponentProps<'div'>['onPointerDown'];
  };
}) {
  const { t } = useTranslation();
  const { repo } = record;
  const position = index >= 0 ? t('drawer.position', { current: index + 1, total }) : null;

  return (
    <div
      className={cn(
        'flex min-h-0 flex-col text-card-foreground',
        mobile ? 'bg-card' : 'max-h-[min(46rem,calc(100svh-3rem))] bg-transparent',
      )}
    >
      {mobile ? (
        <div className="flex h-5 shrink-0 items-center justify-center" aria-hidden="true">
          <span className="h-1 w-8 rounded-full bg-muted-foreground/35" />
        </div>
      ) : null}
      <header className="asterism-glass-surface z-10 shrink-0 border-b px-6 py-4">
        <div
          className={cn(
            'flex min-w-0 touch-none cursor-grab items-center gap-3 active:cursor-grabbing',
            dragSurface?.dragging && 'cursor-grabbing [&_*]:cursor-grabbing',
          )}
          onClickCapture={dragSurface?.onClickCapture}
          onPointerDown={dragSurface?.onPointerDown}
        >
          <div className="min-w-0 flex-1">
            <h2
              id="repo-quick-look-title"
              className="flex min-h-8 min-w-0 items-center text-repo-name"
            >
              <a
                href={`https://github.com/${repoFullName(repo)}`}
                target="_blank"
                rel="noreferrer noopener"
                draggable={false}
                aria-label={t('browse.openOnGitHub', { repo: repoFullName(repo) })}
                className="group/link min-w-0 cursor-[inherit] truncate rounded-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="font-medium text-muted-foreground">{repo.owner}</span>
                <span className="text-muted-foreground"> / </span>
                <span className="text-link group-hover/link:underline">{repo.name}</span>
              </a>
            </h2>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <ControlButton
              data-window-control
              label={t('common.close')}
              tooltip={!mobile}
              className={cn('cursor-pointer', mobile && '-m-1.5 size-11')}
              onClick={onClose}
            >
              <XIcon className="size-4" />
            </ControlButton>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="min-w-0 truncate font-mono text-micro text-muted-foreground tabular-nums">
            {position ?? t('drawer.outsideSequence')}
          </span>
          <div className="flex items-center gap-1">
            <ControlButton
              label={t('drawer.previous')}
              className={cn(mobile && '-my-1.5 size-11')}
              disabled={!hasPrevious}
              onClick={onPrevious}
            >
              <ChevronLeftIcon className="size-4" />
            </ControlButton>
            <ControlButton
              label={t('drawer.next')}
              className={cn(mobile && '-my-1.5 size-11')}
              disabled={!hasNext}
              onClick={onNext}
            >
              <ChevronRightIcon className="size-4" />
            </ControlButton>
          </div>
        </div>
      </header>

      <div className={cn('px-6 py-5', !mobile && 'min-h-0 flex-1 overflow-y-auto')}>
        <div
          key={record.repoId}
          className="animate-in fade-in-0 duration-[120ms] motion-reduce:animate-none"
        >
          <Overview record={record} onReadReadme={onReadReadme} />
          <div className="mt-6 flex flex-col gap-5">
            <MemorySection record={record} />
            <RelatedStarsSection record={record} />
            <CollectionsSection repoId={record.repoId} />
          </div>
        </div>
      </div>
      <UnsavedMemoryDialog />
    </div>
  );
}

function Overview({
  record,
  onReadReadme,
}: {
  record: StarredRepoRecord;
  onReadReadme: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { repo } = record;
  const dotColor = languageColor(repo.language);
  const updated = formatRelativeTime(repo.pushedAt, i18n.language);
  const compactUpdated = formatCompactRelativeTime(repo.pushedAt, i18n.language);
  return (
    <section className="border-b pb-5">
      {repo.description ? (
        <p className="max-w-[70ch] text-body text-foreground/85 text-pretty">{repo.description}</p>
      ) : null}
      <div
        className={cn(
          'flex flex-wrap items-center gap-x-3 gap-y-1.5 text-micro text-muted-foreground',
          repo.description && 'mt-4',
        )}
      >
        {repo.language ? (
          <span className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={cn('size-2 rounded-full', !dotColor && 'bg-muted-foreground')}
              style={dotColor ? { backgroundColor: dotColor } : undefined}
            />
            {repo.language}
          </span>
        ) : null}
        <span className="flex items-center gap-1">
          <StarIcon className="size-3" aria-hidden="true" />
          <span className="font-mono tabular-nums">
            {formatCompactNumber(repo.stargazers, i18n.language)}
          </span>
          {t('drawer.starLabel')}
        </span>
        {repo.forks != null ? (
          <span className="flex items-center gap-1">
            <GitForkIcon className="size-3" aria-hidden="true" />
            <span className="font-mono tabular-nums">
              {formatCompactNumber(repo.forks, i18n.language)}
            </span>
            {t('drawer.forkLabel')}
          </span>
        ) : null}
        {updated && compactUpdated ? (
          <span title={t('browse.updated', { time: updated })}>
            <span aria-hidden="true">
              {t('browse.updatedShort')}{' '}
              <span className="font-mono tabular-nums">{compactUpdated}</span>
            </span>
            <span className="sr-only">{t('browse.updated', { time: updated })}</span>
          </span>
        ) : null}
        {repo.archived ? (
          <span className="flex items-center gap-1">
            <ArchiveIcon className="size-3" aria-hidden="true" />
            {t('browse.archived')}
          </span>
        ) : null}
        {record.unstarredAt ? <span>{t('browse.unstarred')}</span> : null}
      </div>
      <button
        type="button"
        onClick={onReadReadme}
        className="mt-4 flex min-h-11 w-full items-center gap-3 rounded-md px-2 text-left text-body font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:bg-accent/80"
      >
        <BookOpenIcon className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className="flex-1">{t('drawer.readReadme')}</span>
        <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />
      </button>
    </section>
  );
}
