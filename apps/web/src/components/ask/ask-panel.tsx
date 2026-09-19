import type { StarredRepoRecord } from '@asterism/db';
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, Input } from '@asterism/ui';
import {
  LoaderCircleIcon,
  MessageCircleQuestionIcon,
  SearchXIcon,
  SettingsIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
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
      {/* 内容随开合挂载 / 卸载：会话态（问答历史）随关闭自然复位 */}
      {open ? <AskPanelContent onOpenChange={onOpenChange} /> : null}
      <span className="sr-only">{t('ask.description')}</span>
    </Dialog>
  );
}

function AskPanelContent({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const inspector = useRepoInspector();
  const ask = useAskQuestion();
  const [question, setQuestion] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = ask.phase.kind === 'recalling' || ask.phase.kind === 'generating';

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

  return (
    <DialogContent
      className="top-[10%] max-w-[calc(100%-2rem)] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-2xl"
      closeLabel={t('common.close')}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        inputRef.current?.focus();
      }}
    >
      <DialogTitle className="sr-only">{t('ask.title')}</DialogTitle>
      <DialogDescription className="sr-only">{t('ask.description')}</DialogDescription>
      <form onSubmit={submit} className="flex items-center gap-2.5 border-b px-4">
        <MessageCircleQuestionIcon
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          ref={inputRef}
          value={question}
          aria-label={t('ask.questionLabel')}
          placeholder={t('ask.placeholder')}
          disabled={busy}
          onChange={(inputEvent) => setQuestion(inputEvent.target.value)}
          className="h-12 border-0 px-0 text-[14px] shadow-none focus-visible:ring-0 dark:bg-transparent"
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

      <div className="asterism-scroll-gutter flex max-h-[min(28rem,60vh)] flex-col gap-6 overflow-y-auto px-4 py-4">
        {!ask.configured ? (
          <AskSetupView
            onOpenSettings={() => {
              onOpenChange(false);
              navigate('/settings');
            }}
          />
        ) : ask.turns.length === 0 && ask.phase.kind === 'idle' ? (
          <p className="text-caption text-muted-foreground">{t('ask.emptyHint')}</p>
        ) : (
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
        )}
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
      <AskPendingView phase={phase} onRetry={onRetry} onOpenSettings={onOpenSettings} />
    </>
  );
}

function AskSetupView({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-start gap-3 py-2">
      <span className="flex items-center gap-2 font-medium text-foreground text-sm">
        <SettingsIcon className="size-4 text-muted-foreground" aria-hidden="true" />
        {t('ask.needsSetupTitle')}
      </span>
      <p className="text-caption text-muted-foreground">{t('ask.needsSetupDescription')}</p>
      <Button size="xs" variant="outline" onClick={onOpenSettings}>
        {t('ask.openSettings')}
      </Button>
    </div>
  );
}

function AskTurnView({ turn, onOpenRepo }: { turn: AskTurn; onOpenRepo: OpenRepoHandler }) {
  const records = turn.candidates.map((candidate) => candidate.item);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-caption text-muted-foreground">
        <span aria-hidden="true">› </span>
        {turn.question}
      </p>
      <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-foreground">
        {turn.summary}
      </p>
      {turn.recommendations.length > 0 ? (
        <ul className="flex flex-col gap-2">
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
