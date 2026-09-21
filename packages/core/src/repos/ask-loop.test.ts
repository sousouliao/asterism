import { describe, expect, it } from 'vitest';
import {
  ASK_LOOP_HARD_ROUNDS,
  ASK_LOOP_RESULT_CHAR_BUDGET,
  ASK_LOOP_SOFT_ROUNDS,
  applyAskReadGate,
  canContinueAskLoop,
  createAskLoopState,
  isAskBudgetStop,
  noteAskToolRound,
} from './ask-loop';

describe('ask loop budget', () => {
  it('tracks expanded ids and lets the loop continue under the soft budget', () => {
    let state = createAskLoopState();
    state = noteAskToolRound(state, { resultChars: 10, expandedIds: ['a', 'a', ''] });
    expect(state.rounds).toBe(1);
    expect(state.expandedRepoIds).toEqual(['a']);
    expect(canContinueAskLoop(state)).toBe(true);
  });

  it('raises soft, token, then hard stops in that priority order', () => {
    let soft = createAskLoopState();
    for (let round = 0; round < ASK_LOOP_SOFT_ROUNDS; round += 1) {
      soft = noteAskToolRound(soft, { resultChars: 1 });
    }
    expect(soft.stopReason).toBe('soft_budget');
    expect(isAskBudgetStop(soft.stopReason)).toBe(true);

    const token = noteAskToolRound(createAskLoopState(), {
      resultChars: ASK_LOOP_RESULT_CHAR_BUDGET,
    });
    expect(token.stopReason).toBe('token_budget');

    let hard = createAskLoopState();
    for (let round = 0; round < ASK_LOOP_HARD_ROUNDS; round += 1) {
      hard = noteAskToolRound(hard, { resultChars: 1 });
    }
    expect(hard.stopReason).toBe('hard_budget');
    expect(canContinueAskLoop(hard)).toBe(false);
  });
});

describe('applyAskReadGate', () => {
  it('keeps only expanded ids, in order, without duplicates', () => {
    expect(applyAskReadGate(['b', 'a', 'b', 'missing', ''], ['a', 'b'])).toEqual(['b', 'a']);
  });
});
