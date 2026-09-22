import { cn } from '@asterism/ui';
import {
  ArrowLeftIcon,
  CheckIcon,
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
    <div className="flex h-full max-h-[min(36rem,calc(100dvh_-_8.5rem))] w-full flex-col rounded-2xl border border-black/[0.08] dark:border-white/15 bg-white/75 dark:bg-[#131A24]/85 backdrop-blur-2xl p-1.5 shadow-[inset_0_1px_1.5px_rgba(255,255,255,1)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
      {/* 浮动顶栏：去除生硬截断分割线，以纯净负空间与内容自然对齐 */}
      <div className="flex shrink-0 items-center justify-between px-2 pt-1 pb-1 mb-0.5 select-none">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="flex size-6 items-center justify-center rounded-full border-0 text-muted-foreground hover:text-foreground hover:bg-black/[0.05] dark:hover:bg-white/10 transition-colors cursor-pointer"
            title={t('ask.history.backToChat')}
            aria-label={t('ask.history.backToChat')}
          >
            <ArrowLeftIcon className="size-3.5" />
          </button>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-foreground tracking-tight">
              {t('ask.history.title')}
            </span>
            <span className="rounded-full bg-black/[0.04] dark:bg-white/5 px-1.5 py-0.2 text-[10px] font-medium text-muted-foreground">
              {t('ask.history.sessionCount', { count: sessions.length })}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {confirmClearOpen ? (
            <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
              <span className="text-[11px] text-destructive hidden sm:inline font-medium">
                {t('ask.history.confirmClear')}?
              </span>
              <button
                type="button"
                onClick={() => {
                  onClearAll();
                  setConfirmClearOpen(false);
                }}
                className="flex items-center gap-1 rounded-full bg-destructive px-2.5 py-0.5 text-[11px] font-medium text-destructive-foreground hover:opacity-90 shadow-xs transition-all cursor-pointer border-0"
              >
                <CheckIcon className="size-3" />
                <span>{t('ask.history.confirmClear')}</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmClearOpen(false)}
                className="flex size-5 items-center justify-center rounded-full border-0 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
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
                className="flex items-center gap-1 rounded-full border-0 px-2 py-0.5 text-[11px] text-muted-foreground/70 hover:bg-destructive/10 hover:text-destructive transition-all cursor-pointer"
              >
                <Trash2Icon className="size-3" />
                <span>{t('ask.history.clearAll')}</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* 历史会话卡片流：内嵌纯净列表行 */}
      <div
        ref={listRef}
        className="flex-1 min-h-0 overflow-y-auto space-y-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex size-10 items-center justify-center rounded-xl border-0 bg-black/[0.03] dark:bg-white/5 text-muted-foreground mb-2.5">
              <HistoryIcon className="size-5 opacity-60" />
            </div>
            <p className="text-xs font-medium text-foreground">{t('ask.history.emptyTitle')}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 max-w-xs leading-relaxed">
              {t('ask.history.emptyDescription')}
            </p>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="flex size-10 items-center justify-center rounded-xl border-0 bg-black/[0.03] dark:bg-white/5 text-muted-foreground mb-2.5">
              <SearchXIcon className="size-5 opacity-60" />
            </div>
            <p className="text-xs font-medium text-foreground">{t('ask.history.noResultsTitle')}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 max-w-xs leading-relaxed">
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
                  'group relative flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-all duration-150 select-none cursor-pointer border border-transparent',
                  isHighlighted
                    ? 'border-primary/25 bg-primary/[0.07] dark:border-primary/30 dark:bg-primary/[0.14] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]'
                    : 'hover:bg-black/[0.03] dark:hover:bg-white/5',
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelectSession(session)}
                  className="flex flex-1 min-w-0 flex-col gap-0.5 text-left cursor-pointer focus-visible:outline-none"
                >
                  {/* 标题行：左对齐首字平齐，当前会话在尾部附微胶囊 */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={cn(
                        'text-xs truncate transition-colors',
                        isHighlighted
                          ? 'font-semibold text-primary'
                          : 'font-medium text-foreground',
                      )}
                    >
                      {session.title}
                    </span>
                    {isActive ? (
                      <span className="shrink-0 rounded-full border border-primary/25 bg-primary/10 px-1.5 py-0.2 text-[10px] font-medium text-primary">
                        {t('ask.history.activeBadge')}
                      </span>
                    ) : null}
                  </div>

                  {/* 副行：极简扫描元数据，无冗余毛刺图标，中文间隔点 */}
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span>{formatRelativeTime(session.updatedAt, t)}</span>
                    {recCount > 0 ? (
                      <>
                        <span>·</span>
                        <span>{t('ask.history.recommendationCount', { count: recCount })}</span>
                      </>
                    ) : null}
                    {session.turns.length > 1 ? (
                      <>
                        <span>·</span>
                        <span>{t('ask.history.turnCount', { count: session.turns.length })}</span>
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
                    className="flex size-6 items-center justify-center rounded-full text-muted-foreground/60 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-destructive/15 hover:text-destructive transition-all cursor-pointer border-0"
                    title={t('ask.history.deleteAria')}
                    aria-label={t('ask.history.deleteAria')}
                  >
                    <Trash2Icon className="size-3" />
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
