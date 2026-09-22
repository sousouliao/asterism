import { cn } from '@asterism/ui';
import {
  ArrowLeftIcon,
  CheckIcon,
  ClockIcon,
  HistoryIcon,
  SearchXIcon,
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
        (t) =>
          t.question.toLowerCase().includes(cleanFilter) ||
          t.summary.toLowerCase().includes(cleanFilter),
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
    <div className="flex h-full max-h-[min(34rem,calc(100dvh-10rem))] w-full flex-col rounded-3xl border border-[var(--border)]/60 bg-[var(--card)]/80 p-3 sm:p-4 shadow-2xl backdrop-blur-3xl backdrop-saturate-[190%]">
      {/* 顶部工具栏 */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)]/40 pb-3 px-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="flex size-7 items-center justify-center rounded-lg border border-[var(--border)]/60 bg-[var(--secondary)]/60 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
            title={t('ask.history.backToChat')}
            aria-label={t('ask.history.backToChat')}
          >
            <ArrowLeftIcon className="size-3.5" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--foreground)]">
              {t('ask.history.title')}
            </span>
            <span className="rounded-full bg-[var(--secondary)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted-foreground)]">
              {t('ask.history.sessionCount', { count: sessions.length })}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {confirmClearOpen ? (
            <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
              <span className="text-xs text-[var(--destructive)] hidden sm:inline">
                {t('ask.history.confirmClear')}?
              </span>
              <button
                type="button"
                onClick={() => {
                  onClearAll();
                  setConfirmClearOpen(false);
                }}
                className="flex items-center gap-1 rounded-lg bg-[var(--destructive)] px-2 py-1 text-xs font-medium text-[var(--destructive-foreground)] hover:opacity-90 transition-opacity cursor-pointer"
              >
                <CheckIcon className="size-3" />
                <span>{t('ask.history.confirmClear')}</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmClearOpen(false)}
                className="flex size-6 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
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
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[var(--muted-foreground)] hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)] transition-colors cursor-pointer"
              >
                <Trash2Icon className="size-3.5" />
                <span>{t('ask.history.clearAll')}</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* 历史列表内容区 */}
      <div
        ref={listRef}
        className="flex-1 min-h-0 overflow-y-auto pt-2 space-y-1.5 asterism-scroll-gutter"
      >
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-[var(--secondary)] text-[var(--muted-foreground)] mb-3">
              <HistoryIcon className="size-5 opacity-60" />
            </div>
            <p className="text-sm font-medium text-[var(--foreground)]">
              {t('ask.history.emptyTitle')}
            </p>
            <p className="text-xs text-[var(--muted-foreground)] mt-1 max-w-xs">
              {t('ask.history.emptyDescription')}
            </p>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-[var(--secondary)] text-[var(--muted-foreground)] mb-3">
              <SearchXIcon className="size-5 opacity-60" />
            </div>
            <p className="text-sm font-medium text-[var(--foreground)]">
              {t('ask.history.noResultsTitle')}
            </p>
            <p className="text-xs text-[var(--muted-foreground)] mt-1 max-w-xs">
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
                  'group relative flex items-center justify-between gap-2 rounded-2xl p-2.5 sm:p-3 text-left transition-all border select-none',
                  isHighlighted
                    ? 'border-[var(--primary)]/40 bg-[var(--accent)]/90 shadow-sm'
                    : 'border-transparent hover:border-[var(--border)]/40 hover:bg-[var(--secondary)]/50',
                  isActive && 'ring-1 ring-[var(--primary)]/50 bg-[var(--primary)]/5',
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelectSession(session)}
                  className="flex flex-1 min-w-0 flex-col gap-1.5 text-left cursor-pointer focus-visible:outline-none"
                >
                  <div className="flex items-center gap-2">
                    {isActive ? (
                      <span className="shrink-0 flex items-center gap-1 rounded-full bg-[var(--primary)]/15 px-1.5 py-0.2 text-[10px] font-semibold text-[var(--primary)]">
                        <span className="size-1.5 rounded-full bg-[var(--primary)]" />
                        {t('ask.history.activeBadge')}
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        'text-sm font-medium truncate',
                        isActive
                          ? 'text-[var(--primary)] font-semibold'
                          : 'text-[var(--foreground)]',
                      )}
                    >
                      {session.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-[var(--muted-foreground)]">
                    <span className="flex items-center gap-1">
                      <ClockIcon className="size-3 opacity-60" />
                      {formatRelativeTime(session.updatedAt, t)}
                    </span>
                    <span>•</span>
                    <span>{t('ask.history.turnCount', { count: session.turns.length })}</span>
                    {recCount > 0 ? (
                      <>
                        <span>•</span>
                        <span>{t('ask.history.recommendationCount', { count: recCount })}</span>
                      </>
                    ) : null}
                  </div>
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onDeleteSession(session.id)}
                    className="flex size-7 items-center justify-center rounded-lg text-[var(--muted-foreground)] opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)] transition-all cursor-pointer"
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
