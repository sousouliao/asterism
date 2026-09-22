import type { StarredRepoRecord } from '@asterism/db';
import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  StreamingMarkdown,
} from '@asterism/ui';
import {
  CheckIcon,
  ChevronDownIcon,
  HistoryIcon,
  LoaderCircleIcon,
  MessageCircleQuestionIcon,
  SearchXIcon,
  SettingsIcon,
  SparklesIcon,
  SquareIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useRepoInspector } from '../../contexts/repo-inspector-context';
import { type AskPhase, type AskTurn, useAskQuestion } from '../../data/use-ask-question';
import type { AvailableAiModel } from '../../lib/ai-connections';
import type { AskSessionRecord } from '../../lib/ask-session-storage';
import type { RepoOpenModality } from '../../stores/repo-inspector';
import { AskHistoryView } from './ask-history-view';
import { AskRecommendationCard } from './ask-recommendation-card';
import { type AskSlashCommandId, AskSlashMenu } from './ask-slash-menu';

/** 面板渲染所需的最小状态面：生产由 useAskQuestion 提供，dev 预览可注入 fixture。 */
export interface AskViewState {
  phase: AskPhase;
  turns: readonly AskTurn[];
  ask: (question: string) => void;
  continueAsk?: () => void;
  stop?: () => void;
  reset?: () => void;
  configured: boolean;
  currentModel?: string | null;
  availableModels?: readonly AvailableAiModel[];
  selectModel?: (model: string) => void;
  currentSessionId?: string | null;
  sessions?: readonly AskSessionRecord[];
  loadSession?: (session: AskSessionRecord) => void;
  startNewSession?: () => void;
  deleteSession?: (sessionId: string) => Promise<void>;
  clearAllSessions?: () => Promise<void>;
  refreshSessions?: () => Promise<void>;
}

type OpenRepoHandler = (
  record: StarredRepoRecord,
  records: readonly StarredRepoRecord[],
  modality: RepoOpenModality,
) => void;

/** 页面底部 Ask 输入区的聚焦快捷键（跨平台：macOS ⌘K，其余 Ctrl+K）。 */
export function isAskShortcut(event: KeyboardEvent): boolean {
  return (event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'k';
}

export function askShortcutLabel(): string {
  return /mac/i.test(navigator.platform) ? '⌘K' : 'Ctrl K';
}

/** 生产接线：常驻 shell 底部输入区；未提问时仅显示 full 圆角输入胶囊，内容随问答在上方生长。 */
export function AskDock({ focusRequest }: { focusRequest?: number }) {
  const ask = useAskQuestion();
  return <AskDockContent ask={ask} focusRequest={focusRequest} />;
}

/**
 * 底部居中的对话舱：composer 为独立的 full 圆角输入胶囊，未提问时不遮挡页面；
 * 问答在输入框上方生长展现，用户消息靠右、Asterism 回答靠左，支持右上角关闭或 Esc 收起。
 */
export function AskDockContent({
  ask,
  focusRequest,
}: {
  ask: AskViewState;
  focusRequest?: number;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const inspector = useRepoInspector();
  const [question, setQuestion] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [dockView, setDockView] = useState<'chat' | 'history'>('chat');
  const [slashHighlightIndex, setSlashHighlightIndex] = useState(0);
  const [historyHighlightIndex, setHistoryHighlightIndex] = useState(0);

  const dockRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const firstScroll = useRef(true);
  const followScroll = useRef(true);
  const prevTurnsLength = useRef(ask.turns.length);
  const busy = ask.phase.kind === 'generating';

  const isSlashOpen = dockView === 'chat' && question.startsWith('/') && !busy;
  const hasThread =
    dockView === 'history'
      ? true
      : ask.configured
        ? ask.turns.length > 0 || ask.phase.kind !== 'idle'
        : true;
  const isExpanded = hasThread && !collapsed;
  const openSettings = () => navigate('/settings');

  const deepseekModels = ask.availableModels?.filter((m) => m.provider === 'deepseek') ?? [];
  const openaiModels = ask.availableModels?.filter((m) => m.provider === 'openai') ?? [];
  const hasModels = (ask.availableModels?.length ?? 0) > 0;

  const filteredSessions = useMemo(() => {
    const cleanFilter = question.trim().toLowerCase();
    const allSessions = ask.sessions ?? [];
    if (!cleanFilter || dockView !== 'history') {
      return allSessions;
    }
    return allSessions.filter((s) => {
      if (s.title.toLowerCase().includes(cleanFilter)) {
        return true;
      }
      return s.turns.some(
        (t) =>
          t.question.toLowerCase().includes(cleanFilter) ||
          t.summary.toLowerCase().includes(cleanFilter),
      );
    });
  }, [ask.sessions, question, dockView]);

  const handleSelectSlashCommand = useCallback(
    (cmdId: AskSlashCommandId) => {
      if (cmdId === 'new') {
        ask.startNewSession?.() ?? ask.reset?.();
        setDockView('chat');
        setQuestion('');
        setCollapsed(false);
        inputRef.current?.focus();
      } else if (cmdId === 'history') {
        setDockView('history');
        setQuestion('');
        setHistoryHighlightIndex(0);
        setCollapsed(false);
        inputRef.current?.focus();
      }
    },
    [ask],
  );

  const handleSelectSession = useCallback(
    (session: AskSessionRecord) => {
      ask.loadSession?.(session);
      setDockView('chat');
      setQuestion('');
      setCollapsed(false);
      inputRef.current?.focus();
    },
    [ask],
  );

  // 新提问或处于生成状态时自动展开
  useEffect(() => {
    if (busy || ask.turns.length > prevTurnsLength.current) {
      setCollapsed(false);
    }
    prevTurnsLength.current = ask.turns.length;
  }, [busy, ask.turns.length]);

  useEffect(() => {
    if (focusRequest) {
      setCollapsed(false);
      inputRef.current?.focus();
    }
  }, [focusRequest]);

  // 点击外部空白处（Click Outside）自动折叠
  useEffect(() => {
    if (!isExpanded) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      if (dockRef.current?.contains(target)) {
        return;
      }
      const element = target as HTMLElement;
      if (
        element.closest?.('[data-radix-popper-content-wrapper], [role="menu"], [role="dialog"]')
      ) {
        return;
      }
      setCollapsed(true);
      if (dockView === 'history') {
        setDockView('chat');
        setQuestion('');
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [isExpanded, dockView]);

  // 全局 Esc 快捷键折叠
  useEffect(() => {
    if (!isExpanded) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (document.activeElement === inputRef.current && question) {
          return;
        }
        setCollapsed(true);
        if (dockView === 'history') {
          setDockView('chat');
          setQuestion('');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isExpanded, question, dockView]);

  /** 贴底优先走 ref callback：Radix Portal + StrictMode 下挂载期 effect 早于 ref 附加执行。 */
  const scrollLogToBottom = (behavior: ScrollBehavior) => {
    const el = scrollRef.current;
    if (!el || typeof el.scrollTo !== 'function') {
      return;
    }
    el.scrollTo({ top: el.scrollHeight, behavior });
  };

  const attachLog = (node: HTMLDivElement | null) => {
    scrollRef.current = node;
    if (!node) {
      firstScroll.current = true;
      return;
    }
    scrollLogToBottom('auto');
    if (!firstScroll.current) {
      return;
    }
    firstScroll.current = false;
    // 兜底：内容随字体加载导致高度变化时，下一帧再贴一次
    requestAnimationFrame(() => scrollLogToBottom('auto'));
  };

  const openRepo: OpenRepoHandler = (record, records, modality) => {
    inspector.requestOpen(record, { sourceKey: 'ask', records }, modality);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (dockView === 'history') {
      const target = filteredSessions[historyHighlightIndex];
      if (target) {
        handleSelectSession(target);
      }
      return;
    }

    const trimmed = question.trim();
    if (!trimmed || busy) {
      return;
    }

    if (trimmed.startsWith('/')) {
      const match = trimmed.toLowerCase();
      if (match === '/new') {
        handleSelectSlashCommand('new');
        return;
      }
      if (match === '/history' || match === '/h') {
        handleSelectSlashCommand('history');
        return;
      }
    }

    setCollapsed(false);
    followScroll.current = true;
    ask.ask(trimmed);
    setQuestion('');
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (dockView === 'history') {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHistoryHighlightIndex((prev) =>
          Math.min(Math.max(0, filteredSessions.length - 1), prev + 1),
        );
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHistoryHighlightIndex((prev) => Math.max(0, prev - 1));
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        if (question) {
          setQuestion('');
        } else {
          setDockView('chat');
        }
        return;
      }
      return;
    }

    if (isSlashOpen) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSlashHighlightIndex((prev) => (prev + 1) % 2);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSlashHighlightIndex((prev) => (prev - 1 + 2) % 2);
        return;
      }
      if (event.key === 'Tab' || (event.key === 'Enter' && !event.shiftKey)) {
        event.preventDefault();
        const cmdId: AskSlashCommandId = slashHighlightIndex === 0 ? 'history' : 'new';
        handleSelectSlashCommand(cmdId);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setQuestion('');
        return;
      }
    }

    if (event.key === 'Escape') {
      if (question) {
        setQuestion('');
      } else if (isExpanded) {
        setCollapsed(true);
      } else if (hasThread && collapsed && ask.reset) {
        ask.reset();
      }
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: turns/phase 变化即需平滑贴底
  useLayoutEffect(() => {
    if (firstScroll.current || !followScroll.current) {
      // 挂载贴底由 attachLog 负责；用户上滚后停止跟随
      return;
    }
    scrollLogToBottom(
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    );
  }, [ask.turns, ask.phase]);

  return (
    <div
      ref={dockRef}
      data-ask-dock
      className="pointer-events-none fixed bottom-0 right-0 left-0 lg:left-60 z-40 flex flex-col items-center justify-end px-4 pb-4 sm:pb-6"
    >
      {/* 右侧工作区专属流体 Liquid Glass 氛围层：展开时自底部向上平滑羽化，保护左侧边栏独立性 */}
      {isExpanded ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed bottom-0 right-0 left-0 lg:left-60 -z-10 h-[min(52rem,92vh)] overflow-hidden animate-in fade-in duration-300 motion-reduce:animate-none"
        >
          {/* 基础高阶模糊层 + 线性渐隐蒙版：自下而上从 100% 渐变到 0% 丝滑融于页面 */}
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-[var(--background)]/80 to-transparent backdrop-blur-2xl backdrop-saturate-[190%] [mask-image:linear-gradient(to_top,black_40%,transparent_100%)]" />
          {/* 液态微流光：底部中央轻微的冷光晕染，赋予真正的液体玻璃光泽感 */}
          <div className="absolute inset-x-0 bottom-0 h-3/4 bg-[radial-gradient(ellipse_80%_60%_at_50%_100%,rgba(37,99,235,0.06),transparent_70%)] dark:bg-[radial-gradient(ellipse_80%_60%_at_50%_100%,rgba(96,165,250,0.08),transparent_70%)]" />
        </div>
      ) : null}

      <div
        className={cn(
          'flex w-full flex-col items-center gap-2.5 transition-[max-width] duration-200 [transition-timing-function:var(--ease-out-quart)]',
          isExpanded ? 'max-w-2xl xl:max-w-3xl' : 'max-w-xl xl:max-w-2xl',
        )}
      >
        {isExpanded ? (
          dockView === 'history' ? (
            <div className="pointer-events-auto flex max-h-[min(36rem,calc(100dvh_-_8.5rem))] w-full flex-col animate-in fade-in slide-in-from-bottom-2 duration-200 motion-reduce:animate-none">
              <AskHistoryView
                sessions={ask.sessions ?? []}
                currentSessionId={ask.currentSessionId ?? null}
                filterQuery={question}
                highlightedIndex={historyHighlightIndex}
                onHighlightChange={setHistoryHighlightIndex}
                onSelectSession={handleSelectSession}
                onDeleteSession={(id) => ask.deleteSession?.(id)}
                onClearAll={() => ask.clearAllSessions?.()}
                onBack={() => {
                  setDockView('chat');
                  setQuestion('');
                }}
              />
            </div>
          ) : (
            <section
              aria-label={t('ask.title')}
              className="pointer-events-auto flex max-h-[min(36rem,calc(100dvh_-_8.5rem))] w-full flex-col animate-in fade-in slide-in-from-bottom-2 duration-200 motion-reduce:animate-none"
            >
              <p className="sr-only">{t('ask.description')}</p>

              {/* role="log"：新消息只播报增量 */}
              <div
                ref={attachLog}
                role="log"
                aria-busy={busy}
                aria-label={t('ask.title')}
                onScroll={() => {
                  const el = scrollRef.current;
                  if (!el) {
                    return;
                  }
                  followScroll.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
                }}
                className="asterism-scroll-gutter flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-1 py-1"
              >
                {ask.configured ? (
                  <AskThread
                    turns={ask.turns}
                    phase={ask.phase}
                    onOpenRepo={openRepo}
                    onRetry={ask.ask}
                    onContinue={ask.continueAsk}
                    onOpenSettings={openSettings}
                  />
                ) : (
                  <AskSetupView onOpenSettings={openSettings} />
                )}
              </div>
            </section>
          )
        ) : null}

        <form
          onSubmit={submit}
          className="group/composer relative pointer-events-auto flex h-12 w-full items-center gap-2.5 rounded-full border border-black/[0.09] bg-gradient-to-b from-white/98 via-white/94 to-white/98 px-3.5 shadow-[inset_0_1px_1.5px_rgba(255,255,255,1),0_8px_24px_-4px_rgba(15,23,42,0.12),0_2px_6px_-1px_rgba(15,23,42,0.06)] backdrop-blur-2xl transition-all duration-200 [transition-timing-function:var(--ease-out-quart)] hover:border-black/[0.14] hover:shadow-[inset_0_1px_1.5px_rgba(255,255,255,1),0_12px_28px_-4px_rgba(15,23,42,0.16),0_3px_8px_-1px_rgba(15,23,42,0.08)] focus-within:border-primary/70 focus-within:ring-2 focus-within:ring-ring/30 focus-within:shadow-[inset_0_1px_1.5px_rgba(255,255,255,1),0_14px_32px_-4px_rgba(15,23,42,0.2),0_4px_10px_-1px_rgba(15,23,42,0.1)] dark:border-white/[0.16] dark:bg-gradient-to-r dark:from-[#1A2230]/95 dark:via-[#131A24]/90 dark:to-[#1A2230]/95 dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.18),0_12px_36px_-4px_rgba(0,0,0,0.7),0_2px_8px_-1px_rgba(0,0,0,0.5)] dark:hover:border-white/[0.22]"
        >
          {/* Slash 命令浮层 */}
          {isSlashOpen && (
            <AskSlashMenu
              query={question}
              highlightedIndex={slashHighlightIndex}
              onHighlightChange={setSlashHighlightIndex}
              onSelectCommand={handleSelectSlashCommand}
            />
          )}

          {/* 收起状态：横跨输入框的类似横置花括号 { 的渐变流光光拱 */}
          {hasThread && collapsed ? (
            <AskLuminousBracket onClick={() => setCollapsed(false)} label={t('ask.expandThread')} />
          ) : null}

          {dockView === 'history' ? (
            <HistoryIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
          ) : (
            <MessageCircleQuestionIcon
              className="size-4 shrink-0 text-foreground/70"
              aria-hidden="true"
            />
          )}

          <Input
            ref={inputRef}
            value={question}
            aria-label={dockView === 'history' ? t('ask.history.title') : t('ask.questionLabel')}
            placeholder={
              dockView === 'history' ? t('ask.history.searchPlaceholder') : t('ask.placeholder')
            }
            onChange={(inputEvent) => {
              setQuestion(inputEvent.target.value);
              if (dockView === 'history') {
                setHistoryHighlightIndex(0);
              }
            }}
            onFocus={() => {
              if (hasThread && collapsed) {
                setCollapsed(false);
              }
            }}
            onKeyDown={handleKeyDown}
            className="h-full min-w-0 flex-1 border-0 bg-transparent px-0 text-body shadow-none backdrop-blur-none focus-visible:ring-0 dark:bg-transparent"
          />

          {/* 模型切换器（图三：合并可用配置已发现的模型） */}
          {hasModels ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-7 max-w-[130px] shrink-0 items-center gap-1 truncate rounded-full border border-black/[0.06] bg-black/[0.03] px-2.5 font-mono text-micro text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur-xs transition-colors hover:bg-black/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring data-[state=open]:bg-black/[0.06] data-[state=open]:text-foreground dark:border-white/10 dark:bg-white/5 dark:shadow-none dark:hover:bg-white/10 dark:data-[state=open]:bg-white/10 aria-expanded:bg-black/[0.06] aria-expanded:text-foreground dark:aria-expanded:bg-white/10 sm:max-w-[200px] sm:text-caption"
                  aria-label={t('ask.switchModel')}
                >
                  <span className="truncate">{ask.currentModel ?? t('ask.switchModel')}</span>
                  <ChevronDownIcon className="size-3 shrink-0 opacity-60" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-56 font-mono text-xs">
                {deepseekModels.length > 0 ? (
                  <>
                    <DropdownMenuLabel className="font-sans text-micro text-muted-foreground">
                      DeepSeek
                    </DropdownMenuLabel>
                    {deepseekModels.map((item) => (
                      <DropdownMenuItem
                        key={`deepseek-${item.model}`}
                        onSelect={() => ask.selectModel?.(item.model)}
                        className="flex items-center justify-between font-mono text-xs"
                      >
                        <span className="truncate">{item.model}</span>
                        {ask.currentModel === item.model ? (
                          <CheckIcon className="size-3.5 text-foreground" />
                        ) : null}
                      </DropdownMenuItem>
                    ))}
                  </>
                ) : null}
                {deepseekModels.length > 0 && openaiModels.length > 0 ? (
                  <DropdownMenuSeparator />
                ) : null}
                {openaiModels.length > 0 ? (
                  <>
                    <DropdownMenuLabel className="font-sans text-micro text-muted-foreground">
                      OpenAI
                    </DropdownMenuLabel>
                    {openaiModels.map((item) => (
                      <DropdownMenuItem
                        key={`openai-${item.model}`}
                        onSelect={() => ask.selectModel?.(item.model)}
                        className="flex items-center justify-between font-mono text-xs"
                      >
                        <span className="truncate">{item.model}</span>
                        {ask.currentModel === item.model ? (
                          <CheckIcon className="size-3.5 text-foreground" />
                        ) : null}
                      </DropdownMenuItem>
                    ))}
                  </>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={openSettings} className="font-sans text-xs">
                  <SettingsIcon className="size-3.5" />
                  <span>{t('ask.manageConnections')}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <button
              type="button"
              onClick={openSettings}
              className="flex h-7 shrink-0 items-center gap-1 rounded-full border border-black/[0.06] bg-black/[0.03] px-2 text-micro text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur-xs transition-colors hover:bg-black/[0.06] hover:text-foreground dark:border-white/10 dark:bg-white/5 dark:shadow-none dark:hover:bg-white/10 sm:text-caption"
            >
              <span>{t('ask.setupModel')}</span>
            </button>
          )}

          {ask.phase.kind === 'generating' && ask.stop ? (
            <button
              type="button"
              onClick={ask.stop}
              className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={t('ask.stopGenerating')}
            >
              <SquareIcon className="size-3.5 fill-current" aria-hidden="true" />
            </button>
          ) : busy ? (
            <LoaderCircleIcon
              className="size-4 shrink-0 animate-spin text-link motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : (
            <kbd className="hidden h-5 shrink-0 items-center rounded-sm bg-muted px-1.5 font-mono text-micro text-muted-foreground sm:flex">
              ↵
            </kbd>
          )}
        </form>
      </div>
    </div>
  );
}

/**
 * 收起状态下横跨输入框上方的类似横卧花括号 "{" 的渐变流光拱。
 * 两翼平滑贴合输入框上沿左右淡出，中央汇聚为优美的向上尖角，赋予通透流光与点击展开交互。
 */
function AskLuminousBracket({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group pointer-events-auto absolute -top-5 left-1/2 -translate-x-1/2 flex h-6 w-[88%] max-w-lg items-center justify-center transition-all duration-300 hover:-top-6 focus-visible:outline-none"
      aria-label={label}
      title={label}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 400 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full overflow-visible transition-transform duration-300 group-hover:scale-y-110"
      >
        <defs>
          <linearGradient id="ask-bracket-glow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
            <stop offset="25%" stopColor="#60a5fa" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#818cf8" stopOpacity="0.85" />
            <stop offset="75%" stopColor="#60a5fa" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="ask-bracket-spine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="25%" stopColor="#ffffff" stopOpacity="0.35" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.98" />
            <stop offset="75%" stopColor="#ffffff" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <filter id="ask-bracket-blur" x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
          </filter>
        </defs>

        {/* 底层柔焦电光蓝光晕 */}
        <path
          d="M 0 22 C 60 22, 110 17, 150 10 C 175 5.5, 192 2, 200 2 C 208 2, 225 5.5, 250 10 C 290 17, 340 22, 400 22"
          stroke="url(#ask-bracket-glow)"
          strokeWidth="6"
          strokeLinecap="round"
          filter="url(#ask-bracket-blur)"
          className="opacity-75 transition-opacity duration-300 group-hover:opacity-100"
        />

        {/* 表层晶莹高光流线（横置 { 曲线脊线） */}
        <path
          d="M 0 22 C 60 22, 110 17, 150 10 C 175 5.5, 192 2, 200 2 C 208 2, 225 5.5, 250 10 C 290 17, 340 22, 400 22"
          stroke="url(#ask-bracket-spine)"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="opacity-85 transition-opacity duration-300 group-hover:opacity-100"
        />

        {/* 中央尖峰聚光微星 */}
        <circle
          cx="200"
          cy="2"
          r="1.75"
          className="fill-white shadow-[0_0_8px_#ffffff] transition-all duration-300 group-hover:r-2.5 group-hover:fill-white"
        />
      </svg>
    </button>
  );
}

/** 问答线程渲染：完成的轮次 + 当前进行中 / 收尾状态（面板与 dev 预览共用）。 */
export function AskThread({
  turns,
  phase,
  onOpenRepo,
  onRetry,
  onContinue,
  onOpenSettings,
}: {
  turns: readonly AskTurn[];
  phase: AskPhase;
  onOpenRepo: OpenRepoHandler;
  onRetry: (question: string) => void;
  onContinue?: () => void;
  /** key 失效等需要离开面板去设置的路径；预览场景可传空操作。 */
  onOpenSettings?: () => void;
}) {
  return (
    <>
      {turns.map((turn) => (
        <AskTurnView key={turn.id} turn={turn} onOpenRepo={onOpenRepo} />
      ))}
      <AskLiveTurnView
        phase={phase}
        onRetry={onRetry}
        onContinue={onContinue}
        onOpenSettings={onOpenSettings}
      />
    </>
  );
}

function AskSetupView({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-2.5 rounded-2xl border border-white/80 bg-gradient-to-b from-white/95 via-white/85 to-[#F1F5F9]/80 px-6 py-6 text-center text-foreground shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.95)] backdrop-blur-xl dark:border-white/[0.12] dark:bg-gradient-to-b dark:from-[#1A2230]/80 dark:via-[#131A24]/75 dark:to-[#0F141C]/70 dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
      <span className="flex items-center gap-2 font-medium text-foreground text-sm">
        <SettingsIcon className="size-4 text-muted-foreground" aria-hidden="true" />
        {t('ask.needsSetupTitle')}
      </span>
      <p className="max-w-[44ch] text-caption text-muted-foreground">
        {t('ask.needsSetupDescription')}
      </p>
      <Button size="xs" variant="outline" className="mt-2" onClick={onOpenSettings}>
        {t('ask.openSettings')}
      </Button>
    </div>
  );
}

/** 一轮已完成的问答：用户问题在右、回答与推荐在左（双侧气泡）。 */
function AskTurnView({ turn, onOpenRepo }: { turn: AskTurn; onOpenRepo: OpenRepoHandler }) {
  const records = turn.recommendations.map((candidate) => candidate.item);
  return (
    <div className="flex flex-col gap-3">
      <AskQuestionBubble question={turn.question} />
      <AskAnswerBubble>
        <StreamingMarkdown content={turn.summary} />
        {turn.recommendations.length > 0 ? (
          <ul className="flex w-full flex-col gap-2 pt-1">
            {turn.recommendations.map((candidate) => (
              <AskRecommendationCard
                key={candidate.repoId}
                candidate={candidate}
                onSelect={(record, modality) => onOpenRepo(record, records, modality)}
              />
            ))}
          </ul>
        ) : null}
      </AskAnswerBubble>
    </div>
  );
}

/** 进行中 / 收尾的一轮：问题先行入列，回答位置由状态气泡占位（不影响已完成轮次）。 */
function AskLiveTurnView({
  phase,
  onRetry,
  onContinue,
  onOpenSettings,
}: {
  phase: AskPhase;
  onRetry: (question: string) => void;
  onContinue?: () => void;
  onOpenSettings?: () => void;
}) {
  if (phase.kind === 'idle' || phase.kind === 'answered') {
    return null;
  }
  return (
    <div className="flex flex-col gap-3">
      <AskQuestionBubble question={phase.question} />
      <AskAnswerBubble>
        <AskPendingView
          phase={phase}
          onRetry={onRetry}
          onContinue={onContinue}
          onOpenSettings={onOpenSettings}
        />
      </AskAnswerBubble>
    </div>
  );
}

/** 用户消息：右对齐的深海冷晶黑曜石气泡，微冷渐变 + 水晶内高光，沉稳克制无外部阴影。 */
function AskQuestionBubble({ question }: { question: string }) {
  const { t } = useTranslation();
  return (
    <div className="ml-auto max-w-[80%] xl:max-w-[75%] animate-in fade-in slide-in-from-bottom-2 duration-200 [--tw-ease:var(--ease-out-quart)] motion-reduce:animate-none">
      <p className="rounded-2xl rounded-br-xs border border-white/25 bg-gradient-to-br from-[#1E293B]/95 to-[#0F172A]/90 px-4 py-2.5 text-body leading-relaxed text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.35)] backdrop-blur-md dark:border-white/15 dark:from-[#24334A]/85 dark:to-[#182333]/80 dark:text-[#F2F4F7] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
        <span className="sr-only">{t('ask.speakerYou')}: </span>
        {question}
      </p>
    </div>
  );
}

/** Asterism 回答：左对齐凝脂冰霜白玉气泡，微冷渐变 + 入射内高光，正文锐利清晰，无外部黑阴影。 */
function AskAnswerBubble({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="mr-auto flex w-full max-w-[95%] sm:max-w-[92%] flex-col items-start gap-2.5 rounded-2xl rounded-tl-xs border border-white/80 bg-gradient-to-b from-white/95 via-white/85 to-[#F1F5F9]/80 px-4 py-3 text-foreground shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.95)] backdrop-blur-xl dark:border-white/[0.12] dark:bg-gradient-to-b dark:from-[#1A2230]/80 dark:via-[#131A24]/75 dark:to-[#0F141C]/70 dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] animate-in fade-in slide-in-from-bottom-2 duration-200 [--tw-ease:var(--ease-out-quart)] motion-reduce:animate-none">
      <div className="flex items-center gap-1.5 text-micro font-medium text-muted-foreground select-none">
        <SparklesIcon className="size-3 text-primary" aria-hidden="true" />
        <span>{t('ask.title')}</span>
      </div>
      <div className="flex w-full min-w-0 flex-col items-start gap-3">
        <span className="sr-only">{t('ask.speakerAsterism')}: </span>
        {children}
      </div>
    </div>
  );
}

function AskPendingView({
  phase,
  onRetry,
  onContinue,
  onOpenSettings,
}: {
  phase: AskPhase;
  onRetry: (question: string) => void;
  onContinue?: () => void;
  onOpenSettings?: () => void;
}) {
  const { t } = useTranslation();
  if (phase.kind === 'generating') {
    if (phase.text.length > 0) {
      return <StreamingMarkdown content={phase.text} animated />;
    }
    return (
      <p className="flex items-center gap-2 text-caption text-muted-foreground" role="status">
        <LoaderCircleIcon
          className="size-3.5 animate-spin text-link motion-reduce:animate-none"
          aria-hidden="true"
        />
        {phase.toolLabel === 'filtering'
          ? t('ask.filtering')
          : phase.toolLabel === 'searching'
            ? t('ask.searching')
            : phase.toolLabel === 'expanding'
              ? t('ask.expanding')
              : t('ask.generating')}
      </p>
    );
  }
  if (phase.kind === 'budget_exhausted') {
    return (
      <div className="flex flex-col items-start gap-2" role="status">
        {phase.text.length > 0 ? <StreamingMarkdown content={phase.text} /> : null}
        <p className="text-caption text-muted-foreground">{t('ask.budgetExhausted')}</p>
        {onContinue ? (
          <Button size="xs" variant="outline" onClick={onContinue}>
            {t('ask.continueExploring')}
          </Button>
        ) : null}
      </div>
    );
  }
  if (phase.kind === 'not_found') {
    return (
      <p className="flex items-center gap-2 text-caption text-foreground" role="status">
        <SearchXIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        {t('ask.notFound')}
      </p>
    );
  }
  if (phase.kind === 'error') {
    return (
      <div className="flex flex-col items-start gap-2" role="alert">
        <p className="flex items-center gap-2 text-caption text-foreground">
          <TriangleAlertIcon className="size-4 shrink-0 text-warning" aria-hidden="true" />
          {t(
            phase.reason === 'timeout'
              ? 'ask.errorTimeout'
              : phase.reason === 'invalid_key'
                ? 'ask.errorInvalidKey'
                : phase.reason === 'provider_rejected'
                  ? 'ask.errorProviderRejected'
                  : 'ask.errorRetryable',
          )}
        </p>
        {phase.reason !== 'invalid_key' ? (
          <Button size="xs" variant="outline" onClick={() => onRetry(phase.question)}>
            {t('common.retry')}
          </Button>
        ) : onOpenSettings ? (
          <Button size="xs" variant="outline" onClick={onOpenSettings}>
            {t('ask.openSettings')}
          </Button>
        ) : null}
      </div>
    );
  }
  return null;
}
