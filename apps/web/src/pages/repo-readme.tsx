import type { RepoReadmeOutcome } from '@asterism/db';
import { Button, ReadmeDocumentSkeleton, Skeleton } from '@asterism/ui';
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  BookOpenIcon,
  ExternalLinkIcon,
  RefreshCwIcon,
} from 'lucide-react';
import { lazy, type ReactNode, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useGitHubReconnect } from '../auth/use-github-reconnect';
import { EmptyState } from '../components/empty-state';
import { PendingActionContent } from '../components/pending-action-content';
import { useCollections } from '../data/use-collections';
import { useRepoReadme } from '../data/use-repo-readme';
import { useForwardWorkspaceMotion } from '../hooks/use-forward-workspace-motion';
import { useMediaQuery } from '../hooks/use-media-query';
import { type ReadmeRouteState, resolveReadmeReturn } from '../lib/readme-navigation';
import type { ReadmeOutlineItem } from '../lib/readme-outline';
import { prepareReadmeReturn, rememberReadmeEntry } from '../lib/readme-return-coordinator';
import { measureElementRect } from '../lib/readme-workspace-motion';
import { armReverseWorkspaceMotion } from '../lib/readme-workspace-motion-store';

const ReadmeDocument = lazy(() =>
  import('../components/readme-document').then((module) => ({
    default: module.ReadmeDocument,
  })),
);
const ReadmeOutlineTriggers = lazy(() =>
  import('../components/readme-outline').then((module) => ({
    default: module.ReadmeOutlineTriggers,
  })),
);
const ReadmeOutlineRail = lazy(() =>
  import('../components/readme-outline').then((module) => ({
    default: module.ReadmeOutlineRail,
  })),
);

type ReadmeFailureStatus = Exclude<RepoReadmeOutcome['status'], 'success'>;

const recoveryConfig = {
  not_found: {
    title: 'readme.notFoundTitle',
    description: 'readme.notFoundDescription',
    action: 'check',
    icon: BookOpenIcon,
  },
  not_in_library: {
    title: 'readme.notInLibraryTitle',
    description: 'readme.notInLibraryDescription',
    action: 'browse',
    icon: AlertTriangleIcon,
  },
  rate_limited: {
    title: 'readme.rateLimitedTitle',
    description: 'readme.rateLimitedDescription',
    action: 'reconnect',
    icon: AlertTriangleIcon,
  },
  reconnect_required: {
    title: 'readme.reconnectTitle',
    description: 'readme.reconnectDescription',
    action: 'reconnect',
    icon: AlertTriangleIcon,
  },
  retryable_error: {
    title: 'readme.errorTitle',
    description: 'readme.errorDescription',
    action: 'retry',
    icon: AlertTriangleIcon,
  },
} as const satisfies Record<
  ReadmeFailureStatus,
  {
    title: string;
    description: string;
    action: 'browse' | 'check' | 'reconnect' | 'retry';
    icon: typeof AlertTriangleIcon;
  }
>;

function ReadmeDocumentLoading({ label }: { label: string }) {
  return (
    <ReadmeDocumentSkeleton label={label}>
      <div className="space-y-7" aria-hidden="true">
        <Skeleton className="h-8 w-2/5" />
        <div className="space-y-3">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-11/12" />
          <Skeleton className="h-3 w-4/5" />
        </div>
        <Skeleton className="h-6 w-1/3" />
        <div className="space-y-3">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-6 w-1/4" />
        <div className="space-y-3">
          <Skeleton className="h-3 w-11/12" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      </div>
    </ReadmeDocumentSkeleton>
  );
}

function ReadmeDocumentCrossfade({
  children,
  loadingLabel,
}: {
  children: ReactNode;
  loadingLabel: string;
}) {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [showOutgoing, setShowOutgoing] = useState(() => !reducedMotion);

  useEffect(() => {
    if (reducedMotion) {
      setShowOutgoing(false);
      return;
    }

    const timeout = window.setTimeout(() => setShowOutgoing(false), 160);
    return () => window.clearTimeout(timeout);
  }, [reducedMotion]);

  return (
    <div className="readme-document-crossfade" data-readme-transition="crossfade">
      {showOutgoing ? (
        <div className="readme-document-exit" aria-hidden="true">
          <ReadmeDocumentLoading label={loadingLabel} />
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function RepoReadmePage() {
  const { t } = useTranslation();
  const { owner, name } = useParams<{ owner: string; name: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const readme = useRepoReadme(owner, name);
  const { data: collections } = useCollections();
  const reconnect = useGitHubReconnect();
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pendingSectionFocusRef = useRef<string | null>(null);
  const skipNextHashScrollRef = useRef(false);
  const [outlineItems, setOutlineItems] = useState<ReadmeOutlineItem[]>([]);
  const [activeOutlineId, setActiveOutlineId] = useState<string | null>(null);
  const repo = `${owner ?? ''}/${name ?? ''}`;
  const githubUrl = `https://github.com/${encodeURIComponent(owner ?? '')}/${encodeURIComponent(name ?? '')}`;
  const routeState = location.state as ReadmeRouteState | null;
  const source = routeState?.readme?.source;
  const collectionExists =
    source?.kind === 'collection'
      ? Boolean(collections?.some((item) => item.id === source.id))
      : true;
  const returnDestination = resolveReadmeReturn(routeState, owner ?? '', name ?? '');
  const showCollectionReturn =
    returnDestination.source === 'collection' &&
    returnDestination.collectionName &&
    collectionExists;
  const returnLabel = showCollectionReturn
    ? t('readme.backToCollection', { name: returnDestination.collectionName })
    : t('readme.backToBrowse');
  const { workspaceRef, contentRef } = useForwardWorkspaceMotion(routeState?.readme?.repoId);
  const handleReturn = useCallback(() => {
    const workspaceRect = measureElementRect(workspaceRef.current);
    const repoId = routeState?.readme?.repoId;
    if (workspaceRect && repoId && !reducedMotion) {
      armReverseWorkspaceMotion({
        direction: 'reverse',
        repoId,
        sourceRect: workspaceRect,
      });
    }
    const pending = prepareReadmeReturn({
      state: routeState,
      owner: owner ?? '',
      name: name ?? '',
      collectionExists,
    });
    void navigate(pending.to);
  }, [collectionExists, name, navigate, owner, reducedMotion, routeState, workspaceRef]);

  useEffect(() => {
    rememberReadmeEntry(routeState?.readme);
  }, [routeState]);
  const state = readme.data?.status;
  const findSectionTarget = useCallback(
    (id: string) =>
      Array.from(scrollContainerRef.current?.querySelectorAll<HTMLElement>('[id]') ?? []).find(
        (element) => element.id === id,
      ) ?? null,
    [],
  );
  const navigateToSection = useCallback(
    (id: string) => {
      pendingSectionFocusRef.current = id;
      void navigate({ hash: `#${encodeURIComponent(id)}` });
      setActiveOutlineId(id);
    },
    [navigate],
  );
  useEffect(() => {
    if (outlineItems.length === 0) {
      setActiveOutlineId(null);
      return;
    }
    setActiveOutlineId((current) =>
      current && outlineItems.some((item) => item.id === current)
        ? current
        : (outlineItems[0]?.id ?? null),
    );
  }, [outlineItems]);
  useEffect(() => {
    if (state !== 'success') {
      setOutlineItems([]);
    }
  }, [state]);
  useEffect(() => {
    const hash = location.hash.slice(1);
    if (!hash || outlineItems.length === 0) {
      return;
    }
    if (skipNextHashScrollRef.current) {
      skipNextHashScrollRef.current = false;
      return;
    }
    let id: string;
    try {
      id = decodeURIComponent(hash);
    } catch {
      id = hash;
    }
    const target = findSectionTarget(id);
    if (!target) {
      return;
    }
    setActiveOutlineId(id);
    if (pendingSectionFocusRef.current === id) {
      pendingSectionFocusRef.current = null;
      if (!target.hasAttribute('tabindex')) {
        target.setAttribute('tabindex', '-1');
      }
      target.setAttribute('data-readme-heading-focus', 'true');
      target.focus({ preventScroll: true });
      target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    target.scrollIntoView({ behavior: 'auto', block: 'start' });
  }, [findSectionTarget, location.hash, outlineItems, reducedMotion]);
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer || outlineItems.length === 0) {
      return;
    }
    const trackActiveSection = () => {
      const threshold = scrollContainer.getBoundingClientRect().top + 72;
      let nextId = outlineItems[0]?.id ?? null;
      for (const item of outlineItems) {
        const target = findSectionTarget(item.id);
        if (target && target.getBoundingClientRect().top <= threshold) {
          nextId = item.id;
        }
      }
      if (!nextId || nextId === activeOutlineId) {
        return;
      }
      setActiveOutlineId(nextId);
      skipNextHashScrollRef.current = true;
      void navigate({ hash: `#${encodeURIComponent(nextId)}` }, { replace: true });
    };
    scrollContainer.addEventListener('scroll', trackActiveSection, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', trackActiveSection);
  }, [activeOutlineId, findSectionTarget, navigate, outlineItems]);
  const failureStatus: ReadmeFailureStatus | null = readme.isError
    ? 'retryable_error'
    : state && state !== 'success'
      ? state
      : null;
  const recovery = failureStatus ? recoveryConfig[failureStatus] : null;
  const retry = () => void readme.refetch();
  let recoveryAction: ReactNode = null;
  switch (recovery?.action) {
    case 'browse':
      recoveryAction = (
        <Button variant="outline" className="min-h-11 sm:min-h-9" asChild>
          <Link to="/">{t('readme.backToBrowse')}</Link>
        </Button>
      );
      break;
    case 'reconnect':
      recoveryAction = (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            className="min-h-11 sm:min-h-9"
            disabled={reconnect.reconnectPending}
            onClick={() => void reconnect.reconnect()}
          >
            <PendingActionContent
              pending={reconnect.reconnectPending}
              idleLabel={t('sync.reconnectAction')}
              pendingLabel={t('sync.reconnecting')}
            />
          </Button>
          <Button variant="outline" className="min-h-11 sm:min-h-9" asChild>
            <a href={githubUrl} target="_blank" rel="noreferrer noopener">
              <ExternalLinkIcon className="size-4" aria-hidden="true" />
              {t('readme.openOnGitHub')}
            </a>
          </Button>
        </div>
      );
      break;
    case 'check':
    case 'retry':
      recoveryAction = (
        <Button variant="outline" className="min-h-11 sm:min-h-9" onClick={retry}>
          <RefreshCwIcon className="size-4" aria-hidden="true" />
          {recovery.action === 'check' ? t('readme.checkAgain') : t('readme.retry')}
        </Button>
      );
      break;
  }

  return (
    <div
      ref={workspaceRef}
      data-readme-workspace
      className="@container/readme-workspace -m-6 flex min-h-0 flex-1 flex-col bg-background"
    >
      <header
        data-readme-header
        className="asterism-glass-surface z-10 grid min-h-13 shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,auto)_minmax(0,1fr)] items-center gap-3 border-b px-4 sm:px-6"
      >
        <div className="min-w-0 justify-self-start">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11 min-w-11 max-w-full gap-2 sm:min-h-8 sm:min-w-0"
            onClick={handleReturn}
          >
            <ArrowLeftIcon className="size-4 shrink-0" aria-hidden="true" />
            <span className="hidden truncate sm:inline">{returnLabel}</span>
            <span className="sr-only sm:hidden">{returnLabel}</span>
          </Button>
        </div>
        <div
          data-readme-repo-identity
          className="min-w-0 max-w-full justify-self-center truncate text-center text-body font-semibold"
        >
          <span className="text-muted-foreground">{owner}</span>
          <span className="text-muted-foreground"> / </span>
          <span>{name}</span>
        </div>
        <div className="flex min-w-0 justify-self-end gap-2">
          {outlineItems.length > 0 ? (
            <Suspense fallback={null}>
              <ReadmeOutlineTriggers
                items={outlineItems}
                activeId={activeOutlineId}
                onSelect={navigateToSection}
              />
            </Suspense>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 min-w-11 gap-2 sm:min-h-8 sm:min-w-0"
            asChild
          >
            <a href={githubUrl} target="_blank" rel="noreferrer noopener">
              <ExternalLinkIcon className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">{t('readme.openOnGitHub')}</span>
              <span className="sr-only sm:hidden">{t('readme.openOnGitHub')}</span>
            </a>
          </Button>
        </div>
      </header>

      <div
        ref={(node) => {
          scrollContainerRef.current = node;
          contentRef.current = node;
        }}
        data-readme-scroll-container
        data-readme-motion-content
        className="asterism-scroll-gutter min-h-0 flex-1 overflow-y-auto"
      >
        {readme.isPending ? (
          <ReadmeDocumentLoading label={t('readme.loading')} />
        ) : readme.data?.status === 'success' && owner && name ? (
          <Suspense fallback={<ReadmeDocumentLoading label={t('readme.loading')} />}>
            <ReadmeDocumentCrossfade loadingLabel={t('readme.loading')}>
              <div className="mx-auto w-full @min-[1100px]/readme-workspace:grid @min-[1100px]/readme-workspace:max-w-[76.5rem] @min-[1100px]/readme-workspace:grid-cols-[minmax(0,60rem)_14rem] @min-[1100px]/readme-workspace:gap-6 @min-[1100px]/readme-workspace:px-6">
                <ReadmeDocument
                  html={readme.data.html}
                  owner={owner}
                  name={name}
                  label={t('readme.documentLabel', { repo })}
                  onOutlineChange={setOutlineItems}
                />
                {outlineItems.length > 0 ? (
                  <ReadmeOutlineRail
                    items={outlineItems}
                    activeId={activeOutlineId}
                    onSelect={navigateToSection}
                  />
                ) : null}
              </div>
            </ReadmeDocumentCrossfade>
          </Suspense>
        ) : recovery ? (
          <div className="mx-auto flex min-h-full w-full max-w-3xl items-center px-6 py-10">
            <EmptyState
              icon={recovery.icon}
              title={t(recovery.title)}
              description={t(recovery.description)}
              action={recoveryAction}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
