import { cn } from '@asterism/ui';
import {
  ArrowLeftIcon,
  CheckIcon,
  ClockIcon,
  HistoryIcon,
  SearchXIcon,
  SparklesIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AskSessionRecord } from '../../lib/ask-session-storage';

interface AskHistoryViewProps {
  sessions: readonly AskSessionRecord[];
  currentSessionId: string | null;
  filterQuery: string;
  highlightedIndex: number;
  onHighlightChange: (index: number) => void;
  onSelectSession: (session: AskSessionRecord) => void;
  onDeleteSession: (sessionId: string) => void;
  onClearAll: () => void;
  onBack: () => void;
}

function formatRelativeTime(
  epochMs: number,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - epochMs) / 1000));
  if (diffSec < 60) {
    return t('ask.history.justNow');
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return t('ask.history.minutesAgo', { count: diffMin });
  }
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) {
    return t('ask.history.hoursAgo', { count: diffHour });
  }
  const diffDays = Math.floor(diffHour / 24);
  if (diffDays === 1) {
    return t('ask.history.yesterday');
  }
  return t('ask.history.daysAgo', { count: diffDays });
}

export function AskHistoryView({
  sessions,
  currentSessionId,
  filterQuery,
  highlightedIndex,
  onHighlightChange,
  onSelectSession,
  onDeleteSession,
  onClearAll,
  onBack,
}: AskHistoryViewProps) {
  const { t } = useTranslation();
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const cleanFilter = filterQuery.trim().toLowerCase();
  const filteredSessions = useMemo(() => {
    if (!cleanFilter) {
      return sessions;
    }
    return sessions.filter((s) => {
      if (s.title.toLowerCase().includes(cleanFilter)) {
        return true;
      }
      return s.turns.some(
        (turn) =>
          turn.question.toLowerCase().includes(cleanFilter) ||
          turn.summary.toLowerCase().includes(cleanFilter),
      );
    });
  }, [sessions, cleanFilter]);

  // 保证高亮索引在过滤边界内
  useEffect(() => {
    if (filteredSessions.length === 0) {
      onHighlightChange(0);
    } else if (highlightedIndex >= filteredSessions.length) {
      onHighlightChange(filteredSessions.length - 1);
    }
  }, [filteredSessions.length, highlightedIndex, onHighlightChange]);

  // 键盘移动时自动滚动高亮项进视野
  useEffect(() => {
    if (filteredSessions.length === 0) {
      return;
    }
    const container = listRef.current;
    if (!container) {
      return;
    }
    const activeEl = container.querySelector(
      `[data-session-index="${highlightedIndex}"]`,
    ) as HTMLElement | null;
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [highlightedIndex, filteredSessions.length]);

  return (
    <div className="flex h-full max-h-[min(36rem,calc(100dvh_-_8.5rem))] w-full flex-col gap-2.5">
      {/* 浮动顶栏：纯无边框设计，融入 Liquid Glass 氛围 */}
      <div className="flex shrink-0 items-center justify-between px-1 py-0.5 select-none">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            className="flex size-7 items-center justify-center rounded-full border-0 bg-white/60 dark:bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/90 dark:hover:bg-white/15 backdrop-blur-md transition-all cursor-pointer shadow-xs"
            title={t('ask.history.backToChat')}
            aria-label={t('ask.history.backToChat')}
          >
            <ArrowLeftIcon className="size-3.5" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground tracking-tight">
              {t('ask.history.title')}
            </span>
            <span className="rounded-full border-0 bg-white/40 dark:bg-white/5 px-2 py-0.5 text-[11px] font-medium text-muted-foreground backdrop-blur-xs">
              {t('ask.history.sessionCount', { count: sessions.length })}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {confirmClearOpen ? (
            <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
              <span className="text-xs text-destructive hidden sm:inline font-medium">
                {t('ask.history.confirmClear')}?
              </span>
              <button
                type="button"
                onClick={() => {
                  onClearAll();
                  setConfirmClearOpen(false);
                }}
                className="flex items-center gap-1 rounded-full bg-destructive px-2.5 py-1 text-xs font-medium text-destructive-foreground hover:opacity-90 shadow-xs transition-all cursor-pointer border-0"
              >
                <CheckIcon className="size-3" />
                <span>{t('ask.history.confirmClear')}</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmClearOpen(false)}
                className="flex size-6 items-center justify-center rounded-full border-0 bg-white/60 dark:bg-white/5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title={t('ask.history.cancel')}
              >
                <XIcon className="size-3" />
              </button>
            </div>
          ) : (
            sessions.length > 0 && (
              <button
                type="button"
                onClick={() => setConfirmClearOpen(true)}
                className="flex items-center gap-1.5 rounded-full border-0 bg-white/40 dark:bg-white/5 px-2.5 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive backdrop-blur-xs transition-all cursor-pointer"
              >
                <Trash2Icon className="size-3" />
                <span>{t('ask.history.clearAll')}</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* 历史会话卡片流：纯无边框设计，Memory Tiles 在氛围层中自然铺展 */}
      <div
        ref={listRef}
        className="flex-1 min-h-0 overflow-y-auto space-y-2 px-0.5 py-1 asterism-scroll-gutter"
      >
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div className="flex size-11 items-center justify-center rounded-2xl border-0 bg-white/40 dark:bg-white/5 text-muted-foreground backdrop-blur-md mb-3">
              <HistoryIcon className="size-5 opacity-70" />
            </div>
            <p className="text-sm font-medium text-foreground">{t('ask.history.emptyTitle')}</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">
              {t('ask.history.emptyDescription')}
            </p>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex size-11 items-center justify-center rounded-2xl border-0 bg-white/40 dark:bg-white/5 text-muted-foreground backdrop-blur-md mb-3">
              <SearchXIcon className="size-5 opacity-70" />
            </div>
            <p className="text-sm font-medium text-foreground">{t('ask.history.noResultsTitle')}</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">
              {t('ask.history.noResultsDescription')}
            </p>
          </div>
        ) : (
          filteredSessions.map((session, index) => {
            const isHighlighted = index === highlightedIndex;
            const isActive = session.id === currentSessionId;
            const recCount = session.turns.reduce(
              (acc, turn) => acc + (turn.recommendations?.length ?? 0),
              0,
            );

            return (
              <div
                key={session.id}
                data-session-index={index}
                data-highlighted={isHighlighted ? 'true' : undefined}
                onPointerEnter={() => onHighlightChange(index)}
                className={cn(
                  'group relative flex items-center justify-between gap-3 rounded-2xl p-3 text-left transition-all duration-200 select-none cursor-pointer border-0',
                  // 纯粹依赖 Liquid Glass 毛玻璃底色与平滑浮雕反馈，无多重硬线框
                  'backdrop-blur-xl',
                  isActive
                    ? 'bg-primary/[0.08] dark:bg-primary/[0.16] shadow-xs'
                    : 'bg-white/45 dark:bg-white/[0.04] hover:bg-white/75 dark:hover:bg-white/[0.09]',
                  isHighlighted && 'bg-white/90 dark:bg-white/[0.14] -translate-y-0.5 shadow-md',
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelectSession(session)}
                  className="flex flex-1 min-w-0 flex-col gap-1 text-left cursor-pointer focus-visible:outline-none"
                >
                  <div className="flex items-center gap-2">
                    {isActive ? (
                      <span className="shrink-0 flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                        {t('ask.history.activeBadge')}
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        'text-sm font-medium truncate',
                        isActive ? 'text-primary font-semibold' : 'text-foreground',
                      )}
                    >
                      {session.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <ClockIcon className="size-3 opacity-60" />
                      {formatRelativeTime(session.updatedAt, t)}
                    </span>
                    <span>•</span>
                    <span>{t('ask.history.turnCount', { count: session.turns.length })}</span>
                    {recCount > 0 ? (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-primary/85">
                          <SparklesIcon className="size-2.5 opacity-80" />
                          {t('ask.history.recommendationCount', { count: recCount })}
                        </span>
                      </>
                    ) : null}
                  </div>
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    className="flex size-7 items-center justify-center rounded-full text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-destructive/15 hover:text-destructive backdrop-blur-xs transition-all cursor-pointer border-0"
                    title={t('ask.history.deleteAria')}
                    aria-label={t('ask.history.deleteAria')}
                  >
                    <Trash2Icon className="size-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
