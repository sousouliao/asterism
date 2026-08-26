import { describe, expect, it } from 'vitest';
import { BulkExecutionError, type BulkExecutionStore, executeBulkOperation } from './executor';
import type { BulkItemStatus, BulkOperationItem } from './handler';

function item(id: string, status: BulkItemStatus = 'pending'): BulkOperationItem {
  return {
    id,
    repoId: `repo-${id}`,
    relationType: 'collection',
    targetId: 'collection-1',
    action: 'add',
    status,
    attemptCount: 0,
    lastErrorCode: null,
    lastErrorMessage: null,
    effectiveChanged: false,
    effectiveMutationId: null,
    effectiveRelationVersion: null,
  };
}

function store(items: BulkOperationItem[]): BulkExecutionStore & { applied: string[] } {
  const applied: string[] = [];
  return {
    applied,
    claimItems: async (_userId, _operationId, statuses) =>
      items.filter((candidate) => statuses.includes(candidate.status)),
    applyItem: async (_userId, candidate) => {
      applied.push(candidate.id);
      return { effectiveChanged: true, effectiveMutationId: null, effectiveRelationVersion: null };
    },
    recordItemResult: async (_userId, itemId, result) => {
      const candidate = items.find((current) => current.id === itemId);
      if (candidate) {
        candidate.status = result.status;
        candidate.attemptCount += 1;
        candidate.lastErrorCode = result.errorCode;
        candidate.lastErrorMessage = result.errorMessage;
        candidate.effectiveChanged = result.effectiveChanged;
        candidate.effectiveMutationId = result.effectiveMutationId;
        candidate.effectiveRelationVersion = result.effectiveRelationVersion;
      }
    },
    refreshOperation: async (_userId, operationId) => ({
      id: operationId,
      source: 'manual',
      interaction: 'bulk_dialog',
      clientRequestId: '11111111-1111-4111-8111-111111111111',
      sourceRepoIds: items.map((candidate) => candidate.repoId),
      status: items.every((candidate) => candidate.status === 'succeeded')
        ? 'completed'
        : 'needs_attention',
      completedAt: null,
      createdAt: '2026-07-19T00:00:00.000Z',
      updatedAt: '2026-07-19T00:00:00.000Z',
      items,
    }),
  };
}

describe('bulk relationship executor', () => {
  it('keeps successful relationships while recording retryable and terminal failures separately', async () => {
    const items = [item('success'), item('retryable'), item('terminal')];
    const memory = store(items);
    memory.applyItem = async (_userId, candidate) => {
      memory.applied.push(candidate.id);
      if (candidate.id === 'retryable') {
        throw new BulkExecutionError('retryable', 'service_unavailable', 'Try again later');
      }
      if (candidate.id === 'terminal') {
        throw new BulkExecutionError('terminal', 'target_not_owned', 'Target is unavailable');
      }
      return { effectiveChanged: true, effectiveMutationId: null, effectiveRelationVersion: null };
    };

    const result = await executeBulkOperation(memory, 'user-1', 'operation-1', 'pending');

    expect(result?.items.map(({ id, status }) => ({ id, status }))).toEqual([
      { id: 'success', status: 'succeeded' },
      { id: 'retryable', status: 'retryable_failed' },
      { id: 'terminal', status: 'terminal_failed' },
    ]);
  });

  it('retries only retryable failures and never redoes successful or terminal items', async () => {
    const items = [
      item('success', 'succeeded'),
      item('retryable', 'retryable_failed'),
      item('terminal', 'terminal_failed'),
    ];
    const memory = store(items);

    await executeBulkOperation(memory, 'user-1', 'operation-1', 'retryable');

    expect(memory.applied).toEqual(['retryable']);
    expect(items.map(({ id, status }) => ({ id, status }))).toEqual([
      { id: 'success', status: 'succeeded' },
      { id: 'retryable', status: 'succeeded' },
      { id: 'terminal', status: 'terminal_failed' },
    ]);
  });

  it('maps unexpected failures to a safe retryable result without leaking internals', async () => {
    const items = [item('unexpected')];
    const memory = store(items);
    memory.applyItem = async () => {
      throw new Error('postgres://secret@internal/database');
    };

    const result = await executeBulkOperation(memory, 'user-1', 'operation-1', 'pending');

    expect(result?.items[0]).toMatchObject({
      status: 'retryable_failed',
      lastErrorCode: 'temporary_failure',
      lastErrorMessage: 'The relationship could not be updated. Try again.',
    });
    expect(JSON.stringify(result)).not.toContain('postgres://');
  });
});
