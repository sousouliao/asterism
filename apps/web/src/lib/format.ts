const RELATIVE_UNITS: { unit: Intl.RelativeTimeFormatUnit; ms: number }[] = [
  { unit: 'year', ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: 'month', ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: 'week', ms: 7 * 24 * 60 * 60 * 1000 },
  { unit: 'day', ms: 24 * 60 * 60 * 1000 },
  { unit: 'hour', ms: 60 * 60 * 1000 },
  { unit: 'minute', ms: 60 * 1000 },
];

/** 紧凑数字，如 1247 → "1.2K"（跟随 locale）。 */
export function formatCompactNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

/** 相对时间，如 "2 days ago"（跟随 locale）；无效输入返回 null。 */
export function formatRelativeTime(iso: string | null, locale: string): string | null {
  if (!iso) {
    return null;
  }
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) {
    return null;
  }
  const diff = time - Date.now();
  const abs = Math.abs(diff);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  for (const { unit, ms } of RELATIVE_UNITS) {
    if (abs >= ms) {
      return formatter.format(Math.round(diff / ms), unit);
    }
  }
  return formatter.format(Math.round(diff / 1000), 'second');
}

const COMPACT_RELATIVE_UNITS: { en: string; zh: string; ms: number }[] = [
  { en: 'y', zh: '年', ms: 365 * 24 * 60 * 60 * 1000 },
  { en: 'mo', zh: '个月', ms: 30 * 24 * 60 * 60 * 1000 },
  { en: 'w', zh: '周', ms: 7 * 24 * 60 * 60 * 1000 },
  { en: 'd', zh: '天', ms: 24 * 60 * 60 * 1000 },
  { en: 'h', zh: '小时', ms: 60 * 60 * 1000 },
  { en: 'm', zh: '分钟', ms: 60 * 1000 },
];

/** 卡片时间轴使用的紧凑相对时间，如 "2w" / "2周前"；无效输入返回 null。 */
export function formatCompactRelativeTime(
  iso: string | null,
  locale: string,
  now = Date.now(),
): string | null {
  if (!iso) {
    return null;
  }
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) {
    return null;
  }

  const diff = time - now;
  const abs = Math.abs(diff);
  const isChinese = locale.toLowerCase().startsWith('zh');
  for (const unit of COMPACT_RELATIVE_UNITS) {
    if (abs >= unit.ms) {
      const value = Math.max(1, Math.round(abs / unit.ms));
      if (isChinese) {
        return `${value}${unit.zh}${diff > 0 ? '后' : '前'}`;
      }
      return diff > 0 ? `in ${value}${unit.en}` : `${value}${unit.en}`;
    }
  }

  return isChinese ? '刚刚' : 'now';
}

const DAY_DURATION_UNITS: { en: string; zh: string; days: number }[] = [
  { en: 'y', zh: '年', days: 365 },
  { en: 'mo', zh: '个月', days: 30 },
  { en: 'd', zh: '天', days: 1 },
];

/** 天数时长的紧凑表达，如 "2y" / "2年"，用于唤醒理由里的沉睡与静默时长。 */
export function formatCompactDayDuration(days: number, locale: string): string {
  const isChinese = locale.toLowerCase().startsWith('zh');
  const clamped = Math.max(0, Math.floor(days));
  for (const unit of DAY_DURATION_UNITS) {
    if (clamped >= unit.days) {
      const value = Math.max(1, Math.floor(clamped / unit.days));
      return isChinese ? `${value}${unit.zh}` : `${value}${unit.en}`;
    }
  }
  return isChinese ? '0天' : '0d';
}
