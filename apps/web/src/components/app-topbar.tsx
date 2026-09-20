import {
  Button,
  cn,
  Input,
  Popover,
  PopoverAnchor,
  PopoverContent,
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@asterism/ui';
import {
  DownloadIcon,
  LoaderCircleIcon,
  MenuIcon,
  MessageCircleQuestionIcon,
  RefreshCwIcon,
  SearchIcon,
  TriangleAlertIcon,
  UnplugIcon,
  XIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useSession } from '../auth/use-session';
import { useEmbeddingBootstrapContext } from '../contexts/embedding-bootstrap-context';
import { useSyncStars } from '../data/use-sync-stars';
import { dismissEmbeddingPrompt, readEmbeddingPromptDismissal } from '../lib/embedding-consent';
import { useBrowseFilters } from '../stores/browse-filters';
import { AskPanel, askShortcutLabel } from './ask/ask-panel';
import { LanguageToggle } from './language-toggle';
import { SearchInputIcon } from './search-input-icon';
import { SidebarNav } from './sidebar-nav';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';

export function AppTopbar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchPopoverOpen, setSearchPopoverOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [embeddingPromptDismissed, setEmbeddingPromptDismissed] = useState(false);
  const { session } = useSession();
  const userId = session?.user.id;
  const embedding = useEmbeddingBootstrapContext();
  const sync = useSyncStars();
  const query = useBrowseFilters((state) => state.query);
  const setQuery = useBrowseFilters((state) => state.setQuery);
  const syncPending = sync.requiresReconnect ? sync.reconnectPending : sync.isPending;
  const syncLabel = sync.requiresReconnect
    ? sync.reconnectPending
      ? t('sync.reconnecting')
      : t('sync.reconnectAction')
    : sync.isPending
      ? t('sync.syncing')
      : t('topbar.sync');
  const embeddingProgress =
    embedding.phase === 'loading-model'
      ? Math.round(embedding.modelProgress)
      : embedding.phase === 'backfilling' && embedding.total > 0
        ? Math.round((embedding.completed / embedding.total) * 100)
        : 0;
  const showEmbeddingDiscovery = Boolean(
    userId &&
      query.trim() &&
      embedding.repositoryCount > 0 &&
      !embedding.optedIn &&
      embedding.phase === 'idle' &&
      !embeddingPromptDismissed,
  );
  const showEmbeddingProgress = !['idle', 'ready'].includes(embedding.phase);

  useEffect(() => {
    setEmbeddingPromptDismissed(Boolean(userId && readEmbeddingPromptDismissal(userId)));
  }, [userId]);

  return (
    <header className="asterism-glass-surface z-40 flex h-14 shrink-0 items-center gap-3 border-b px-6 py-3">
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            aria-label={t('topbar.openMenu')}
          >
            <MenuIcon className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-60 bg-sidebar p-0">
          <SheetTitle className="sr-only">{t('app.name')}</SheetTitle>
          <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      {pathname === '/' ? (
        <Popover
          open={searchPopoverOpen && (showEmbeddingDiscovery || showEmbeddingProgress)}
          onOpenChange={setSearchPopoverOpen}
        >
          <PopoverAnchor asChild>
            <div className="relative w-full max-w-[400px]">
              <SearchInputIcon className="left-2.5" />
              <Input
                className="h-8 px-9"
                aria-label={t('topbar.searchPlaceholder')}
                placeholder={t('topbar.searchPlaceholder')}
                value={query}
                onFocus={() => setSearchPopoverOpen(true)}
                onChange={(event) => {
                  setQuery(event.target.value);
                  if (event.target.value.trim()) setSearchPopoverOpen(true);
                }}
              />
              {query ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t('topbar.clearSearch')}
                  className="-translate-y-1/2 absolute top-1/2 right-2 size-6 text-muted-foreground hover:bg-accent hover:text-foreground"
                  onClick={() => setQuery('')}
                >
                  <XIcon className="size-4" />
                </Button>
              ) : (
                <kbd className="-translate-y-1/2 absolute top-1/2 right-2 flex h-5 items-center rounded-sm bg-background px-1.5 font-mono text-micro text-muted-foreground">
                  /
                </kbd>
              )}
            </div>
          </PopoverAnchor>
          <PopoverContent
            align="start"
            sideOffset={8}
            className="w-[min(400px,calc(100vw-2rem))] p-3"
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            {showEmbeddingDiscovery ? (
              <div className="flex gap-2.5">
                <SearchIcon className="mt-0.5 size-4 shrink-0 text-link" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-body text-foreground">
                    {t('embeddings.prepareTitle')}
                  </p>
                  <p className="mt-0.5 text-caption text-muted-foreground">
                    {t('embeddings.discoveryDescription')}
                  </p>
                  <p className="mt-1 text-micro text-muted-foreground">
                    {t('embeddings.prepareDescription')}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <Button size="xs" onClick={() => void embedding.start()}>
                      {t('embeddings.prepareAction')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => {
                        if (userId) dismissEmbeddingPrompt(userId);
                        setEmbeddingPromptDismissed(true);
                        setSearchPopoverOpen(false);
                      }}
                    >
                      {t('embeddings.prepareDismiss')}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div role="status" aria-live="polite" className="flex gap-2.5">
                {embedding.phase === 'degraded' ? (
                  <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-warning" />
                ) : embedding.phase === 'loading-model' ? (
                  <DownloadIcon className="mt-0.5 size-4 shrink-0 text-link" />
                ) : (
                  <LoaderCircleIcon className="mt-0.5 size-4 shrink-0 animate-spin text-link motion-reduce:animate-none" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-body text-foreground">
                      {embedding.phase === 'degraded'
                        ? t('embeddings.degradedTitle')
                        : t('embeddings.preparing')}
                    </p>
                    {embedding.phase === 'loading-model' || embedding.phase === 'backfilling' ? (
                      <span className="font-mono text-caption text-muted-foreground">
                        {embeddingProgress}%
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-caption text-muted-foreground">
                    {embedding.phase === 'degraded'
                      ? t('embeddings.degradedDescription')
                      : embedding.phase === 'backfilling'
                        ? t('embeddings.backfilling', {
                            completed: embedding.completed,
                            total: embedding.total,
                          })
                        : embedding.phase === 'loading-model'
                          ? t('embeddings.downloading')
                          : t('embeddings.checking')}
                  </p>
                  {embedding.phase === 'degraded' ? (
                    <Button
                      className="mt-2"
                      variant="outline"
                      size="xs"
                      onClick={() => void embedding.retry()}
                    >
                      {t('common.retry')}
                    </Button>
                  ) : null}
                </div>
              </div>
            )}
          </PopoverContent>
        </Popover>
      ) : null}

      <div className="ml-auto flex items-center gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="xs"
              className="h-8 gap-1.5 px-3 text-body"
              aria-label={t('ask.openMenu')}
              aria-keyshortcuts={askShortcutLabel()}
              onClick={() => setAskOpen(true)}
            >
              <MessageCircleQuestionIcon className="size-3.5" aria-hidden="true" />
              <span className="hidden md:inline">{t('ask.title')}</span>
              <kbd className="hidden h-5 items-center rounded-sm bg-muted px-1.5 font-mono text-micro text-muted-foreground md:flex">
                {askShortcutLabel()}
              </kbd>
            </Button>
          </TooltipTrigger>
          <TooltipContent sideOffset={6} className="max-w-none whitespace-nowrap">
            {t('ask.openMenu')} · {askShortcutLabel()}
          </TooltipContent>
        </Tooltip>
        <AskPanel open={askOpen} onOpenChange={setAskOpen} />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="xs"
              className={cn(
                'h-8 gap-1.5 px-3 text-body',
                sync.requiresReconnect &&
                  'border-warning/35 bg-warning/5 hover:border-warning/50 hover:bg-warning/10',
              )}
              aria-label={syncLabel}
              disabled={syncPending}
              onClick={sync.sync}
            >
              {sync.requiresReconnect ? (
                sync.reconnectPending ? (
                  <LoaderCircleIcon className="size-3.5 animate-spin text-warning motion-reduce:animate-none" />
                ) : (
                  <UnplugIcon className="size-3.5 text-warning" />
                )
              ) : (
                <RefreshCwIcon
                  className={cn(
                    'size-3.5',
                    sync.isPending && 'animate-spin motion-reduce:animate-none',
                  )}
                />
              )}
              <span className="hidden sm:inline">{syncLabel}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent sideOffset={6} className="max-w-none whitespace-nowrap">
            {sync.requiresReconnect ? t('sync.reconnectDescription') : syncLabel}
          </TooltipContent>
        </Tooltip>
        <LanguageToggle />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
