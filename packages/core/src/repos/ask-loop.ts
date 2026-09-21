/** 软预算：到此停下汇报已有证据，UI 提供继续。 */
export const ASK_LOOP_SOFT_ROUNDS = 6;
/** 硬上限：防失控保险丝，正常碰不到。 */
export const ASK_LOOP_HARD_ROUNDS = 10;
/** 工具结果累计字符预算（粗估 token 的 4 倍）。 */
export const ASK_LOOP_RESULT_CHAR_BUDGET = 80_000;

export type AskLoopStopReason =
  | 'answered'
  | 'not_found'
  | 'soft_budget'
  | 'hard_budget'
  | 'token_budget';

export interface AskLoopState {
  rounds: number;
  expandedRepoIds: readonly string[];
  toolResultChars: number;
  stopReason: AskLoopStopReason | null;
}

export function createAskLoopState(): AskLoopState {
  return {
    rounds: 0,
    expandedRepoIds: [],
    toolResultChars: 0,
    stopReason: null,
  };
}

export interface AskLoopRoundInput {
  resultChars: number;
  expandedIds?: readonly string[];
}

/**
 * 记录一轮工具执行。预算在记入后判定：先硬上限，再字符预算，再软预算。
 */
export function noteAskToolRound(state: AskLoopState, input: AskLoopRoundInput): AskLoopState {
  const expanded = new Set(state.expandedRepoIds);
  for (const id of input.expandedIds ?? []) {
    if (id.trim().length > 0) {
      expanded.add(id.trim());
    }
  }
  const next: AskLoopState = {
    rounds: state.rounds + 1,
    expandedRepoIds: [...expanded],
    toolResultChars: state.toolResultChars + Math.max(0, input.resultChars),
    stopReason: null,
  };
  if (next.rounds >= ASK_LOOP_HARD_ROUNDS) {
    return { ...next, stopReason: 'hard_budget' };
  }
  if (next.toolResultChars >= ASK_LOOP_RESULT_CHAR_BUDGET) {
    return { ...next, stopReason: 'token_budget' };
  }
  if (next.rounds >= ASK_LOOP_SOFT_ROUNDS) {
    return { ...next, stopReason: 'soft_budget' };
  }
  return next;
}

export function canContinueAskLoop(state: AskLoopState): boolean {
  return state.stopReason === null;
}

export function isAskBudgetStop(reason: AskLoopStopReason | null): boolean {
  return reason === 'soft_budget' || reason === 'hard_budget' || reason === 'token_budget';
}

/** read gate：只放行本轮已 expand 的 repoId，保序去重。 */
export function applyAskReadGate(
  repoIds: readonly string[],
  expandedRepoIds: ReadonlySet<string> | readonly string[],
): string[] {
  const allowed = expandedRepoIds instanceof Set ? expandedRepoIds : new Set(expandedRepoIds);
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const raw of repoIds) {
    const repoId = raw.trim();
    if (!repoId || seen.has(repoId) || !allowed.has(repoId)) {
      continue;
    }
    seen.add(repoId);
    kept.push(repoId);
  }
  return kept;
}
