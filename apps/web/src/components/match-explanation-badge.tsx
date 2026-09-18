import type { MatchExplanation, MatchReason, MatchReasonKind } from '@asterism/core';
import { Badge, cn, Tooltip, TooltipContent, TooltipTrigger } from '@asterism/ui';
import type { TFunction } from 'i18next';
import { FileTextIcon, NotebookPenIcon, SearchIcon, SparklesIcon, TagIcon } from 'lucide-react';
import type { ComponentType } from 'react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

export interface MatchExplanationBadgeProps {
  explanation: MatchExplanation;
  /** 是否允许展示内联的片段摘要（对于私有记忆理由默认显示，对于客观元数据默认隐藏以防与正文重复） */
  showSnippet?: boolean;
  className?: string;
}

const KIND_ICONS: Record<MatchReasonKind, ComponentType<{ className?: string }>> = {
  why_saved: NotebookPenIcon,
  note: NotebookPenIcon,
  semantic_repo: SparklesIcon,
  topic: TagIcon,
  description: FileTextIcon,
  name: SearchIcon,
};

function getBadgeVariantStyles(kind: MatchReasonKind): string {
  switch (kind) {
    case 'why_saved':
    case 'note':
      return 'border-border bg-accent text-accent-foreground';
    case 'semantic_repo':
      return 'border-primary/25 bg-primary/10 text-link';
    default:
      return 'bg-muted/80 text-muted-foreground border-border/50';
  }
}

export function getMatchReasonLabel(reason: MatchReason, t: TFunction): string {
  switch (reason.kind) {
    case 'why_saved':
      return t('browse.matchReasons.whySaved');
    case 'note':
      return t('browse.matchReasons.note');
    case 'name':
      return t('browse.matchReasons.name');
    case 'description':
      return t('browse.matchReasons.description');
    case 'topic':
      return t('browse.matchReasons.topic', {
        topic: reason.matchedField || reason.snippet,
      });
    case 'semantic_repo':
      return t('browse.matchReasons.semanticRepo');
    default:
      return '';
  }
}

export const MatchExplanationBadge = memo(function MatchExplanationBadge({
  explanation,
  showSnippet = true,
  className,
}: MatchExplanationBadgeProps) {
  const { t } = useTranslation();
  const { primaryReason, reasons } = explanation;
  const Icon = KIND_ICONS[primaryReason.kind] ?? SearchIcon;
  const label = getMatchReasonLabel(primaryReason, t);

  // 仅在命中用户私有记忆（why_saved / note）时，在行内展示引文摘要；
  // 仓库客观元数据（description / name / topic）表面已有对应展示，不重复堆砌截断文本。
  const isPersonalMemoryKind = primaryReason.kind === 'why_saved' || primaryReason.kind === 'note';

  const hasSnippet = Boolean(primaryReason.snippet?.trim());
  const shouldRenderInlineSnippet = showSnippet && hasSnippet && isPersonalMemoryKind;

  const fullTextContent = primaryReason.fullText || primaryReason.snippet;
  const hasMultipleReasons = reasons.length > 1;

  const tooltipText = (
    <div className="flex max-w-sm flex-col gap-2 text-[12px] leading-relaxed">
      <div className="flex items-center gap-1.5 font-medium text-foreground">
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </div>
      {fullTextContent ? (
        <div className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-sm border border-border/40 bg-muted/30 p-2 text-foreground/90 font-normal leading-normal italic select-text">
          "{fullTextContent}"
        </div>
      ) : null}
      {hasMultipleReasons ? (
        <div className="mt-0.5 border-t border-border/50 pt-1.5 text-[11px] text-muted-foreground">
          <div className="mb-1 font-medium text-foreground/70">
            {t('browse.matchReasons.additionalMatches')}
          </div>
          <div className="flex flex-col gap-1">
            {reasons.slice(1).map((r) => {
              const rLabel = getMatchReasonLabel(r, t);
              const rText = r.fullText || r.snippet;
              return (
                <div
                  key={`${r.kind}:${r.matchedField ?? ''}:${r.snippet ?? ''}`}
                  className="flex items-start gap-1"
                >
                  <span>·</span>
                  <span className="font-medium text-foreground/80">{rLabel}</span>
                  {rText && r.kind !== 'topic' ? (
                    <span className="truncate italic text-muted-foreground/80">: "{rText}"</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={t('browse.matchReasons.details', { reason: label })}
          className={cn(
            'inline-flex max-w-full cursor-help items-center gap-1.5 overflow-hidden rounded-sm text-[11px] select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            className,
          )}
        >
          <Badge
            variant="outline"
            className={cn(
              'h-5 shrink-0 gap-1 rounded px-1.5 font-normal tracking-tight transition-colors hover:border-foreground/30',
              getBadgeVariantStyles(primaryReason.kind),
            )}
          >
            <Icon className="size-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{label}</span>
          </Badge>
          {shouldRenderInlineSnippet ? (
            <span className="min-w-0 truncate text-caption text-muted-foreground/80 italic">
              "{primaryReason.snippet}"
            </span>
          ) : null}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} className="p-2.5">
        {tooltipText}
      </TooltipContent>
    </Tooltip>
  );
});
