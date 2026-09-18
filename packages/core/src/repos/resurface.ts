import type { Memory } from '../models/memory';
import type { StarredRepoLike } from './filter';

/**
 * 沉睡唤醒引擎（GitHub #40 Resurface & Memory Streams）：
 * 纯本地、确定性、可解释的推荐流计算。每条候选都附带可验证的结构化理由，
 * 不做黑盒打分，不使用任何服务端或跨用户信号。
 */

export type ResurfaceStreamKind = 'worth_remembering' | 'missing_context';

export type ResurfaceReason =
  | { kind: 'anniversary'; years: number }
  | { kind: 'dormant'; days: number }
  | { kind: 'noted' }
  | { kind: 'repo_quiet'; days: number }
  | { kind: 'missing_why_saved' }
  | { kind: 'noted_without_reason' }
  | { kind: 'high_value'; stargazers: number };

export interface ResurfaceCandidate<T extends StarredRepoLike = StarredRepoLike> {
  item: T;
  repoId: string;
  stream: ResurfaceStreamKind;
  /** 仅用于确定性排序与测试断言，不对用户展示。 */
  score: number;
  /** 按解释优先级排序；reasons[0] === primaryReason。 */
  reasons: ResurfaceReason[];
  primaryReason: ResurfaceReason;
}

export interface ResurfaceStreams<T extends StarredRepoLike = StarredRepoLike> {
  worthRemembering: ResurfaceCandidate<T>[];
  missingContext: ResurfaceCandidate<T>[];
}

export interface DeriveResurfaceInput<T extends StarredRepoLike> {
  items: T[];
  memoriesByRepoId?: ReadonlyMap<string, Memory>;
  /** 用户已反馈（Useful / Dismiss）且仍在压制期内的 repoId。 */
  suppressedRepoIds?: ReadonlySet<string>;
  now?: number;
  worthRememberingLimit?: number;
  missingContextLimit?: number;
}

const MS_PER_DAY = 86_400_000;

/** 进入「沉睡」的最短收藏时长。 */
const DORMANCY_MIN_DAYS = 180;
/** 「待补全记忆」最短收藏时长：刚收藏的项目大概率还记得原因，不急着提醒。 */
const MISSING_CONTEXT_MIN_DAYS = 30;
/** 整年纪念日的判定窗口（±3 天），容忍时区与同步误差。 */
const ANNIVERSARY_WINDOW_DAYS = 3;
/** 仓库静默判定：距最近 push 的天数。 */
const REPO_QUIET_MIN_DAYS = 730;

const WORTH_REMEMBERING_LIMIT = 3;
const MISSING_CONTEXT_LIMIT = 2;

type ReasonPrecedence = Partial<Record<ResurfaceReason['kind'], number>>;

/** 理由展示优先级：纪念日 > 个人记忆 > 仓库客观状态 > 基础沉睡事实。 */
const WORTH_REASON_PRECEDENCE: ReasonPrecedence = {
  anniversary: 1,
  noted: 2,
  repo_quiet: 3,
  dormant: 4,
};
const MISSING_REASON_PRECEDENCE: ReasonPrecedence = {
  missing_why_saved: 1,
  noted_without_reason: 2,
  high_value: 3,
  dormant: 4,
};

function dormancyScore(days: number): number {
  if (days >= 1095) return 40;
  if (days >= 730) return 32;
  if (days >= 365) return 24;
  return 14;
}

function missingAgeScore(days: number): number {
  if (days >= 730) return 20;
  if (days >= 365) return 14;
  return 6;
}

function stargazersScore(stargazers: number): number {
  if (stargazers >= 10_000) return 40;
  if (stargazers >= 1000) return 30;
  if (stargazers >= 100) return 18;
  return 6;
}

function ageInDays(iso: string | null, now: number): number | null {
  if (!iso) {
    return null;
  }
  const time = Date.parse(iso);
  if (!Number.isFinite(time) || time > now) {
    return null;
  }
  return (now - time) / MS_PER_DAY;
}

/** 距最近的整年纪念日相差的天数与年数；不在 ±窗口 内返回 null。 */
function findAnniversary(
  starredAt: string,
  now: number,
): { years: number; dayDelta: number } | null {
  const starred = new Date(starredAt);
  if (Number.isNaN(starred.getTime())) {
    return null;
  }
  const window = ANNIVERSARY_WINDOW_DAYS * MS_PER_DAY;
  const maxYears = Math.floor((now - starred.getTime()) / (365 * MS_PER_DAY)) + 1;
  let best: { years: number; dayDelta: number } | null = null;
  for (let years = 1; years <= maxYears; years += 1) {
    const anniversary = new Date(starred);
    anniversary.setFullYear(anniversary.getFullYear() + years);
    if (anniversary.getTime() <= now + window) {
      best = { years, dayDelta: (now - anniversary.getTime()) / MS_PER_DAY };
    }
  }
  if (!best || Math.abs(best.dayDelta) > ANNIVERSARY_WINDOW_DAYS) {
    return null;
  }
  return best;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function orderReasons(reasons: ResurfaceReason[], precedence: ReasonPrecedence): ResurfaceReason[] {
  return [...reasons].sort((left, right) => {
    const delta = (precedence[left.kind] ?? 99) - (precedence[right.kind] ?? 99);
    return delta !== 0 ? delta : compareStrings(left.kind, right.kind);
  });
}

function makeCandidate<T extends StarredRepoLike>(
  item: T,
  repoId: string,
  stream: ResurfaceStreamKind,
  score: number,
  reasons: ResurfaceReason[],
  precedence: ReasonPrecedence,
): ResurfaceCandidate<T> {
  const ordered = orderReasons(reasons, precedence);
  return {
    item,
    repoId,
    stream,
    score,
    reasons: ordered,
    primaryReason: ordered[0] as ResurfaceReason,
  };
}

function compareCandidates<T extends StarredRepoLike>(
  left: ResurfaceCandidate<T>,
  right: ResurfaceCandidate<T>,
): number {
  return (
    right.score - left.score ||
    right.item.repo.stargazers - left.item.repo.stargazers ||
    compareStrings(left.item.repo.fullName, right.item.repo.fullName) ||
    compareStrings(left.repoId, right.repoId)
  );
}

/**
 * 计算沉睡唤醒双流。仅使用当前用户自己的 star 时间、Memory 完整度与仓库客观元数据；
 * 每条候选的理由只陈述可验证事实（收藏时间、笔记存在性、push 时间、star 数），
 * 不推断「你访问过 / 你可能喜欢」这类产品无法证实的信号。
 */
export function deriveResurfaceStreams<T extends StarredRepoLike>({
  items,
  memoriesByRepoId,
  suppressedRepoIds,
  now = Date.now(),
  worthRememberingLimit = WORTH_REMEMBERING_LIMIT,
  missingContextLimit = MISSING_CONTEXT_LIMIT,
}: DeriveResurfaceInput<T>): ResurfaceStreams<T> {
  const worthRemembering: ResurfaceCandidate<T>[] = [];
  const missingContext: ResurfaceCandidate<T>[] = [];

  for (const item of items) {
    const repoId = item.repoId;
    if (!repoId || suppressedRepoIds?.has(repoId)) {
      continue;
    }

    const starredDays = ageInDays(item.starredAt, now);
    if (starredDays == null || starredDays < MISSING_CONTEXT_MIN_DAYS) {
      continue;
    }

    const memory = memoriesByRepoId?.get(repoId);
    const whySaved = memory?.whySaved?.trim();
    const note = memory?.note?.trim();
    const anniversary = item.starredAt ? findAnniversary(item.starredAt, now) : null;
    const quietDays = ageInDays(item.repo.pushedAt, now);
    const dormant = starredDays >= DORMANCY_MIN_DAYS;

    if (dormant && (anniversary || note || whySaved)) {
      const reasons: ResurfaceReason[] = [{ kind: 'dormant', days: Math.floor(starredDays) }];
      let score = dormancyScore(starredDays);
      if (anniversary) {
        reasons.push({ kind: 'anniversary', years: anniversary.years });
        score += 30;
      }
      if (note) {
        reasons.push({ kind: 'noted' });
        score += 20;
      }
      if (whySaved) {
        score += 10;
      }
      if (quietDays != null && quietDays >= REPO_QUIET_MIN_DAYS) {
        reasons.push({ kind: 'repo_quiet', days: Math.floor(quietDays) });
        score += 8;
      }
      worthRemembering.push(
        makeCandidate(item, repoId, 'worth_remembering', score, reasons, WORTH_REASON_PRECEDENCE),
      );
      continue;
    }

    if (!whySaved) {
      const reasons: ResurfaceReason[] = [{ kind: 'missing_why_saved' }];
      let score = stargazersScore(item.repo.stargazers) + missingAgeScore(starredDays);
      if (note) {
        reasons.push({ kind: 'noted_without_reason' });
        score += 12;
      }
      if (item.repo.stargazers >= 1000) {
        reasons.push({ kind: 'high_value', stargazers: item.repo.stargazers });
      }
      if (starredDays >= 365) {
        reasons.push({ kind: 'dormant', days: Math.floor(starredDays) });
      }
      missingContext.push(
        makeCandidate(item, repoId, 'missing_context', score, reasons, MISSING_REASON_PRECEDENCE),
      );
    }
  }

  return {
    worthRemembering: worthRemembering.sort(compareCandidates).slice(0, worthRememberingLimit),
    missingContext: missingContext.sort(compareCandidates).slice(0, missingContextLimit),
  };
}
