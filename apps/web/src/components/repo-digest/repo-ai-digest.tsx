import type { RepoDigestData } from '@asterism/core';
import { Button, cn, Skeleton } from '@asterism/ui';
import {
  AlertCircleIcon,
  BookOpenTextIcon,
  BrainCircuitIcon,
  BrainCogIcon,
  BrainIcon,
  CheckIcon,
  CopyIcon,
  KeyRoundIcon,
  LightbulbIcon,
  NetworkIcon,
  RefreshCwIcon,
  ScanTextIcon,
  WaypointsIcon,
  WorkflowIcon,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

export type DigestIconType =
  | 'network'
  | 'brain-circuit'
  | 'brain'
  | 'brain-cog'
  | 'workflow'
  | 'waypoints'
  | 'lightbulb'
  | 'scantext'
  | 'book';

export type RepoAiDigestData = RepoDigestData;

export interface RepoAiDigestProps {
  status: 'idle' | 'generating' | 'completed' | 'unconfigured' | 'error';
  data?: RepoAiDigestData | null;
  error?: string | null;
  iconType?: DigestIconType;
  onGenerate?: () => void;
  onRegenerate?: () => void;
  onConfigureKey?: () => void;
  className?: string;
}

function renderDigestIcon(type: DigestIconType, className?: string) {
  switch (type) {
    case 'network':
      return <NetworkIcon className={className} aria-hidden="true" />;
    case 'workflow':
      return <WorkflowIcon className={className} aria-hidden="true" />;
    case 'brain':
      return <BrainIcon className={className} aria-hidden="true" />;
    case 'brain-circuit':
      return <BrainCircuitIcon className={className} aria-hidden="true" />;
    case 'brain-cog':
      return <BrainCogIcon className={className} aria-hidden="true" />;
    case 'waypoints':
      return <WaypointsIcon className={className} aria-hidden="true" />;
    case 'book':
      return <BookOpenTextIcon className={className} aria-hidden="true" />;
    case 'scantext':
      return <ScanTextIcon className={className} aria-hidden="true" />;
    default:
      return <LightbulbIcon className={className} aria-hidden="true" />;
  }
}

export function RepoAiDigest({
  status,
  data,
  iconType = 'lightbulb',
  onGenerate,
  onRegenerate,
  onConfigureKey,
  className,
}: RepoAiDigestProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!data) return;
    const text = [
      `${t('digest.copyDefinition')}${data.definition}`,
      `${t('digest.copyPainPoint')}${data.painPoint}`,
      `${t('digest.copyScenarios')}${data.scenarios}`,
    ].join('\n\n');
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, [data, t]);

  // 1. 未配置 Key 引导态
  if (status === 'unconfigured') {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-3 rounded-lg border border-dashed border-border/80 bg-muted/40 p-3 text-caption',
          className,
        )}
      >
        <div className="flex items-center gap-2 text-muted-foreground">
          <KeyRoundIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>{t('digest.unconfiguredHint')}</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onConfigureKey}
          className="h-7 text-xs font-normal"
        >
          {t('digest.goToConfigure')}
        </Button>
      </div>
    );
  }

  // 2. 生成失败容错态
  if (status === 'error') {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-caption text-destructive',
          className,
        )}
      >
        <div className="flex items-center gap-2">
          <AlertCircleIcon className="size-4 shrink-0" aria-hidden="true" />
          <span>{t('digest.error')}</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onGenerate}
          className="h-7 text-xs font-normal"
        >
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  // 3. 静默未生成态（轻量紧凑的极简微晶条）
  if (status === 'idle') {
    return (
      <div
        className={cn(
          'group flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-secondary/30 px-3 py-2 transition-colors hover:border-border hover:bg-secondary/50',
          className,
        )}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="text-muted-foreground transition-colors group-hover:text-foreground">
            {renderDigestIcon(iconType, 'size-4 shrink-0')}
          </span>
          <div className="min-w-0">
            <p className="truncate text-caption font-medium text-foreground">{t('digest.title')}</p>
            <p className="truncate text-micro text-muted-foreground">{t('digest.subtitle')}</p>
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onGenerate}
          className="h-7 shrink-0 text-caption font-medium text-foreground shadow-xs hover:bg-accent"
        >
          {t('digest.generate')}
        </Button>
      </div>
    );
  }

  // 3. 生成中骨架屏与微光呼吸态
  if (status === 'generating') {
    return (
      <div
        className={cn(
          'rounded-lg border border-border/70 bg-secondary/20 px-3.5 pt-2 pb-2.5 text-card-foreground',
          className,
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-1.5">
          <div className="flex h-6 items-center gap-1.5 text-caption font-medium text-foreground">
            <span className="text-primary animate-pulse">
              {renderDigestIcon(iconType, 'size-3.5')}
            </span>
            <span>{t('digest.generating')}</span>
          </div>
        </div>
        <div className="mt-2 space-y-2.5">
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-4 w-full" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-4 w-[92%]" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-4 w-[85%]" />
          </div>
        </div>
      </div>
    );
  }

  // 4. 已提炼完成态（结构化 3 要素）
  if (!data) return null;

  return (
    <div
      className={cn(
        'group/card rounded-lg border border-border/70 bg-secondary/35 px-3.5 pt-2 pb-2.5 text-card-foreground transition-all duration-150',
        className,
      )}
    >
      {/* 顶栏操作区 */}
      <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-1.5">
        <div className="flex h-6 items-center gap-1.5 text-caption font-medium text-foreground">
          {renderDigestIcon(iconType, 'size-3.5 text-muted-foreground')}
          <span>{t('digest.compactTitle')}</span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-6 gap-1 px-1.5 text-micro text-muted-foreground hover:text-foreground"
            title={t('digest.copy')}
          >
            {copied ? (
              <>
                <CheckIcon className="size-3 text-success" aria-hidden="true" />
                <span className="text-success">{t('digest.copied')}</span>
              </>
            ) : (
              <>
                <CopyIcon className="size-3" aria-hidden="true" />
                <span>{t('digest.copy')}</span>
              </>
            )}
          </Button>

          {onRegenerate ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRegenerate}
              className="h-6 gap-1 px-1.5 text-micro text-muted-foreground hover:text-foreground"
              title={t('digest.regenerate')}
            >
              <RefreshCwIcon className="size-3" aria-hidden="true" />
              <span>{t('digest.regenerate')}</span>
            </Button>
          ) : null}
        </div>
      </div>

      {/* 三要素条目列表 */}
      <div className="mt-2 space-y-2 text-caption">
        <div className="leading-relaxed">
          <span className="font-semibold text-foreground">{t('digest.definitionLabel')}</span>
          <span className="text-foreground/85">{data.definition}</span>
        </div>

        <div className="leading-relaxed">
          <span className="font-semibold text-foreground">{t('digest.painPointLabel')}</span>
          <span className="text-foreground/85">{data.painPoint}</span>
        </div>

        <div className="leading-relaxed">
          <span className="font-semibold text-foreground">{t('digest.scenariosLabel')}</span>
          <span className="text-foreground/85">{data.scenarios}</span>
        </div>
      </div>
    </div>
  );
}
