import type { ResurfaceReason } from '@asterism/core';
import { cn } from '@asterism/ui';
import type { TFunction } from 'i18next';
import {
  CalendarIcon,
  CircleDashedIcon,
  HistoryIcon,
  type LucideIcon,
  MoonIcon,
  NotebookPenIcon,
  StarIcon,
} from 'lucide-react';
import { formatCompactDayDuration, formatCompactNumber } from '../../lib/format';

const REASON_ICONS: Record<ResurfaceReason['kind'], LucideIcon> = {
  anniversary: CalendarIcon,
  dormant: HistoryIcon,
  noted: NotebookPenIcon,
  repo_quiet: MoonIcon,
  missing_why_saved: CircleDashedIcon,
  noted_without_reason: NotebookPenIcon,
  high_value: StarIcon,
};

/** 理由只陈述可验证事实；duration / stars 数值由调用方格式化。 */
export function resurfaceReasonText(reason: ResurfaceReason, t: TFunction, locale: string): string {
  switch (reason.kind) {
    case 'anniversary':
      return t('dashboard.resurface.reasons.anniversary', { count: reason.years });
    case 'dormant':
      return t('dashboard.resurface.reasons.dormant', {
        duration: formatCompactDayDuration(reason.days, locale),
      });
    case 'repo_quiet':
      return t('dashboard.resurface.reasons.repoQuiet', {
        duration: formatCompactDayDuration(reason.days, locale),
      });
    case 'high_value':
      return t('dashboard.resurface.reasons.highValue', {
        value: formatCompactNumber(reason.stargazers, locale),
      });
    case 'noted':
      return t('dashboard.resurface.reasons.noted');
    case 'noted_without_reason':
      return t('dashboard.resurface.reasons.notedWithoutReason');
    case 'missing_why_saved':
      return t('dashboard.resurface.reasons.missingWhySaved');
  }
}

export function ResurfaceReasonItem({
  reason,
  t,
  locale,
  className,
}: {
  reason: ResurfaceReason;
  t: TFunction;
  locale: string;
  className?: string;
}) {
  const Icon = REASON_ICONS[reason.kind];
  return (
    <li className={cn('flex items-center gap-1.5 text-caption text-muted-foreground', className)}>
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {resurfaceReasonText(reason, t, locale)}
    </li>
  );
}
