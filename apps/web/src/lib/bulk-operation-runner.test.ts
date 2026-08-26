import type { BulkOperation } from '@asterism/db';
import { describe, expect, it, vi } from 'vitest';
import { runBulkOperationUntilSettled } from './bulk-operation-runner';

function operation(statuses: BulkOperation['items'][number]['status'][]): BulkOperation {
  return {
    id: 'operation-1',
    source: 'manual',
    interaction: 'bulk_dialog',
    clientRequestId: '11111111-1111-4111-8111-111111111111',
    sourceRepoIds: ['repo-1'],
    status: statuses.some((status) => status === 'pending') ? 'pending' : 'completed',
    completedAt: null,
    createdAt: '2026-07-23T00:00:00.000Z',
    updatedAt: '2026-07-23T00:00:00.000Z',
    items: statuses.map((status, index) => ({
      id: `item-${index}`,
      operationId: 'operation-1',
      repoId: 'repo-1',
      relationType: 'collection',
      targetId: `collection-${index}`,
      action: 'add',
      status,
      attemptCount: status === 'pending' ? 0 : 1,
      lastErrorCode: null,
      lastErrorMessage: null,
      effectiveChanged: status === 'succeeded',
      effectiveMutationId: null,
      effectiveRelationVersion: null,
      createdAt: '2026-07-23T00:00:00.000Z',
      updatedAt: '2026-07-23T00:00:00.000Z',
    })),
  };
}

describe('bounded bulk-operation runner', () => {
  it('drives a confirmed operation through the existing bounded executor', async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce(operation(['pending']))
      .mockResolvedValueOnce(operation(['succeeded']));

    await expect(
      runBulkOperationUntilSettled('operation-1', 'execute', 'pending', invoke),
    ).resolves.toEqual(operation(['succeeded']));
    expect(invoke).toHaveBeenNthCalledWith(1, {
      action: 'get',
      operationId: 'operation-1',
    });
    expect(invoke).toHaveBeenNthCalledWith(2, {
      action: 'execute',
      operationId: 'operation-1',
    });
  });

  it('stops when a bounded batch makes no progress', async () => {
    const pending = operation(['pending']);
    const invoke = vi.fn().mockResolvedValue(pending);

    await expect(
      runBulkOperationUntilSettled('operation-1', 'execute', 'pending', invoke),
    ).resolves.toEqual(pending);
    expect(invoke).toHaveBeenCalledTimes(2);
  });
});
