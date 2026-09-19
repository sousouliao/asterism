import type { StarredRepoRecord } from '@asterism/db';
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
} from '@asterism/ui';
import {
  LoaderCircleIcon,
  MessageCircleQuestionIcon,
  SearchXIcon,
  SettingsIcon,
  TriangleAlertIcon,
  XIcon,
} from 'lucide-react';
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useRepoInspector } from '../../contexts/repo-inspector-context';
import { type AskPhase, type AskTurn, useAskQuestion } from '../../data/use-ask-question';
import type { RepoOpenModality } from '../../stores/repo-inspector';
import { AskRecommendationCard } from './ask-recommendation-card';

export interface AskPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** 面板渲染所需的最小状态面：生产由 useAskQuestion 提供，dev 预览可注入 fixture。 */
export interface AskViewState {
  phase: AskPhase;
  turns: readonly AskTurn[];
  ask: (question: string) => void;
  configured: boolean;
}

type OpenRepoHandler = (
  record: StarredRepoRecord,
  records: readonly StarredRepoRecord[],
  modality: RepoOpenModality,
) => void;

/** 顶栏入口的全局快捷键（跨平台：macOS ⌘K，其余 Ctrl+K）。 */
export function isAskShortcut(event: KeyboardEvent): boolean {
  return (event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'k';
}

export function askShortcutLabel(): string {
  return /mac/i.test(navigator.platform) ? '⌘K' : 'Ctrl K';
}

export function AskPanel({ open, onOpenChange }: AskPanelProps) {
  const { t } = useTranslation();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isAskShortcut(event)) {
        event.preventDefault();
        onOpenChange(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* 内容随开合挂载 / 卸载：会话态（问答历史）随关闭自然复位，hook 也只在打开时运行 */}
      {open ? <AskPanelConnected onOpenChange={onOpenChange} /> : null}
      <span className="sr-only">{t('ask.description')}</span>
    </Dialog>
  );
}

/** 生产接线：面板打开时才挂载 useAskQuestion，纯展示的 AskPanelContent 供预览注入 fixture。 */
function AskPanelConnected({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const ask = useAskQuestion();
  return <AskPanelContent ask={ask} onOpenChange={onOpenChange} />;
}

/**
 * 底部居中的对话舱：composer 固定在舱底、直接可输入；消息自下而上生长，
 * 用户消息靠右、Asterism 回答靠左，超出高度后消息区内部滚动并贴底。
 */
export function AskPanelContent({
  ask,
  onOpenChange,
}: {
  ask: AskViewState;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const inspector = useRepoInspector();
  const [question, setQuestion] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const firstScroll = useRef(true);
  const busy = ask.phase.kind === 'recalling' || ask.phase.kind === 'generating';

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
    const trimmed = question.trim();
    if (!trimmed || busy) {
      return;
    }
    ask.ask(trimmed);
    setQuestion('');
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: turns/phase 变化即需平滑贴底
  useLayoutEffect(() => {
    if (firstScroll.current) {
      // 挂载贴底由 attachLog 负责；此处仅在后续更新时平滑滚动
      return;
    }
    scrollLogToBottom(
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    );
  }, [ask.turns, ask.phase]);

  return (
    <DialogContent
      overlayClassName="bg-black/30"
      showCloseButton={false}
      className="top-auto bottom-4 flex max-h-[min(32rem,calc(100dvh_-_6rem))] translate-y-0 flex-col gap-0 overflow-hidden p-0 sm:bottom-6 sm:max-w-2xl"
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        inputRef.current?.focus();
      }}
    >
      <DialogTitle className="sr-only">{t('ask.title')}</DialogTitle>
      <DialogDescription className="sr-only">{t('ask.description')}</DialogDescription>

      {/* 玻璃小按钮：消息自下方滚过时保持可读，也避开右上角的用户气泡 */}
      <DialogClose asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-3 right-3 rounded-md border border-[var(--glass-border)] bg-[var(--glass-surface)] shadow-[inset_0_1px_0_var(--glass-highlight)] backdrop-blur-[8px]"
          aria-label={t('common.close')}
        >
          <XIcon className="size-4" />
          <span className="sr-only">{t('common.close')}</span>
        </Button>
      </DialogClose>

      {/* role="log"：新消息只播报增量；空态与引导同容器挂载，保证首问也能被播报 */}
      <div
        ref={attachLog}
        role="log"
        aria-label={t('ask.title')}
        className="asterism-scroll-gutter flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pt-11 pb-4"
      >
        {ask.configured ? (
          ask.turns.length > 0 || ask.phase.kind !== 'idle' ? (
            <AskThread
              turns={ask.turns}
              phase={ask.phase}
              onOpenRepo={openRepo}
              onRetry={ask.ask}
              onOpenSettings={() => {
                onOpenChange(false);
                navigate('/settings');
              }}
            />
          ) : (
            <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
              <MessageCircleQuestionIcon
                className="size-5 text-muted-foreground/70"
                aria-hidden="true"
              />
              <p className="max-w-[40ch] text-caption text-muted-foreground">
                {t('ask.emptyHint')}
              </p>
            </div>
          )
        ) : (
          <AskSetupView
            onOpenSettings={() => {
              onOpenChange(false);
              navigate('/settings');
            }}
          />
        )}
      </div>

      <div className="shrink-0 border-t p-3">
        <form
          onSubmit={submit}
          className="flex items-center gap-2.5 rounded-lg border border-input bg-[var(--glass-surface)] px-3.5 shadow-[inset_0_1px_0_var(--glass-highlight)] backdrop-blur-[8px] transition-colors duration-150 [transition-timing-function:var(--ease-out-quart)] focus-within:border-foreground/60"
        >
          <MessageCircleQuestionIcon
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            ref={inputRef}
            value={question}
            aria-label={t('ask.questionLabel')}
            placeholder={t('ask.placeholder')}
            onChange={(inputEvent) => setQuestion(inputEvent.target.value)}
            className="h-11 border-0 bg-transparent px-0 text-[14px] shadow-none backdrop-blur-none focus-visible:ring-0 dark:bg-transparent"
          />
          {busy ? (
            <LoaderCircleIcon
              className="size-4 shrink-0 animate-spin text-link motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : (
            <kbd className="hidden h-5 shrink-0 items-center rounded-sm bg-muted px-1.5 font-mono text-[11px] text-muted-foreground sm:flex">
              ↵
            </kbd>
          )}
        </form>
      </div>
    </DialogContent>
  );
}

/** 问答线程渲染：完成的轮次 + 当前进行中 / 收尾状态（面板与 dev 预览共用）。 */
export function AskThread({
  turns,
  phase,
  onOpenRepo,
  onRetry,
  onOpenSettings,
}: {
  turns: readonly AskTurn[];
  phase: AskPhase;
  onOpenRepo: OpenRepoHandler;
  onRetry: (question: string) => void;
  /** key 失效等需要离开面板去设置的路径；预览场景可传空操作。 */
  onOpenSettings?: () => void;
}) {
  return (
    <>
      {turns.map((turn) => (
        <AskTurnView key={turn.id} turn={turn} onOpenRepo={onOpenRepo} />
      ))}
      <AskLiveTurnView phase={phase} onRetry={onRetry} onOpenSettings={onOpenSettings} />
    </>
  );
}

function AskSetupView({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
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

/** 一轮已完成的问答：用户问题在右、回答与推荐在左。 */
function AskTurnView({ turn, onOpenRepo }: { turn: AskTurn; onOpenRepo: OpenRepoHandler }) {
  const records = turn.candidates.map((candidate) => candidate.item);
  return (
    <div className="flex flex-col gap-3">
      <AskQuestionBubble question={turn.question} />
      <AskAnswerBlock>
        <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-foreground">
          {turn.summary}
        </p>
        {turn.recommendations.length > 0 ? (
          <ul className="flex w-full flex-col gap-2">
            {turn.recommendations.map((recommendation) => {
              const candidate = turn.candidates[recommendation.index];
              if (!candidate) {
                return null;
              }
              return (
                <AskRecommendationCard
                  key={candidate.repoId}
                  candidate={candidate}
                  onSelect={(record, modality) => onOpenRepo(record, records, modality)}
                />
              );
            })}
          </ul>
        ) : null}
      </AskAnswerBlock>
    </div>
  );
}

/** 进行中 / 收尾的一轮：问题先行入列，回答位置由状态行占位（不影响已完成轮次）。 */
function AskLiveTurnView({
  phase,
  onRetry,
  onOpenSettings,
}: {
  phase: AskPhase;
  onRetry: (question: string) => void;
  onOpenSettings?: () => void;
}) {
  if (phase.kind === 'idle' || phase.kind === 'answered') {
    return null;
  }
  return (
    <div className="flex flex-col gap-3">
      <AskQuestionBubble question={phase.question} />
      <AskAnswerBlock>
        <AskPendingView phase={phase} onRetry={onRetry} onOpenSettings={onOpenSettings} />
      </AskAnswerBlock>
    </div>
  );
}

/** 用户消息：右对齐的石墨蓝调气泡，尾角收窄指向 composer。 */
function AskQuestionBubble({ question }: { question: string }) {
  const { t } = useTranslation();
  return (
    <p className="ml-auto max-w-[85%] animate-in rounded-lg rounded-br-sm bg-accent px-3.5 py-2 text-[13px] leading-relaxed text-accent-foreground duration-200 [--tw-ease:var(--ease-out-quart)] fade-in slide-in-from-bottom-2 motion-reduce:animate-none">
      <span className="sr-only">{t('ask.speakerYou')}: </span>
      {question}
    </p>
  );
}

/** Asterism 回答：左对齐纯文本 + 证据卡片，不加气泡以保持阅读面积。 */
function AskAnswerBlock({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="flex w-full flex-col items-start gap-3 animate-in duration-200 [--tw-ease:var(--ease-out-quart)] fade-in slide-in-from-bottom-2 motion-reduce:animate-none">
      <span className="sr-only">{t('ask.speakerAsterism')}: </span>
      {children}
    </div>
  );
}

function AskPendingView({
  phase,
  onRetry,
  onOpenSettings,
}: {
  phase: AskPhase;
  onRetry: (question: string) => void;
  onOpenSettings?: () => void;
}) {
  const { t } = useTranslation();
  if (phase.kind === 'recalling') {
    return (
      <p className="flex items-center gap-2 text-caption text-muted-foreground" role="status">
        <LoaderCircleIcon
          className="size-3.5 animate-spin text-link motion-reduce:animate-none"
          aria-hidden="true"
        />
        {t('ask.recalling')}
      </p>
    );
  }
  if (phase.kind === 'generating') {
    return (
      <p className="flex items-center gap-2 text-caption text-muted-foreground" role="status">
        <LoaderCircleIcon
          className="size-3.5 animate-spin text-link motion-reduce:animate-none"
          aria-hidden="true"
        />
        {t('ask.generating')}
      </p>
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
