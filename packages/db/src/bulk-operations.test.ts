import { describe, expect, it, vi } from 'vitest';
import { invokeBulkOperation } from './bulk-operations';
import type { SupabaseClient } from './client';

function clientReturning(data: unknown) {
  const invoke = vi.fn().mockResolvedValue({ data, error: null });
  return { client: { functions: { invoke } } as unknown as SupabaseClient, invoke };
}

const operation = {
  id: 'operation-1',
  source: 'manual',
  interaction: 'bulk_dialog',
  clientRequestId: '11111111-1111-4111-8111-111111111111',
  sourceRepoIds: ['repo-1'],
  status: 'pending',
  completedAt: null,
  createdAt: '2026-07-19T00:00:00.000Z',
  updatedAt: '2026-07-19T00:00:00.000Z',
  items: [
    {
      id: 'item-1',
      repoId: 'repo-1',
      relationType: 'collection',
      targetId: 'collection-1',
      action: 'add',
      status: 'pending',
      attemptCount: 0,
      lastErrorCode: null,
      lastErrorMessage: null,
      effectiveChanged: false,
      effectiveMutationId: null,
      effectiveRelationVersion: null,
    },
  ],
};

describe('invokeBulkOperation', () => {
  it('creates an operation from the confirmed repository snapshot and changes', async () => {
    const { client, invoke } = clientReturning({ operation });
    const input = {
      action: 'create' as const,
      source: 'manual' as const,
      interaction: 'bulk_dialog' as const,
      clientRequestId: '11111111-1111-4111-8111-111111111111',
      repoIds: ['repo-1'],
      changes: [
        { relationType: 'collection' as const, targetId: 'collection-1', action: 'add' as const },
      ],
    };

    await expect(invokeBulkOperation(client, input)).resolves.toEqual(operation);
    expect(invoke).toHaveBeenCalledWith('bulk-organize', { body: input });
  });

  it.each([
    'get',
    'execute',
    'retry',
    'complete',
  ] as const)('preserves a typed operation returned by %s', async (action) => {
    const { client } = clientReturning({ operation });

    await expect(
      invokeBulkOperation(client, { action, operationId: 'operation-1' }),
    ).resolves.toEqual(operation);
  });

  it('rejects malformed outcomes at the trust boundary', async () => {
    const { client } = clientReturning({ operation: { ...operation, status: 'mystery' } });

    await expect(
      invokeBulkOperation(client, { action: 'get', operationId: 'operation-1' }),
    ).rejects.toThrow('invalid response');
  });

  it('rejects a no-op item carrying a forged effective mutation receipt', async () => {
    const malformed = {
      ...operation,
      items: [
        {
          ...operation.items[0],
          effectiveChanged: false,
          effectiveMutationId: 'mutation-1',
          effectiveRelationVersion: 2,
        },
      ],
    };
    const { client } = clientReturning({ operation: malformed });

    await expect(
      invokeBulkOperation(client, { action: 'get', operationId: 'operation-1' }),
    ).rejects.toThrow('invalid response');
  });

  it('rejects unknown projection fields instead of silently widening the trust boundary', async () => {
    const { client } = clientReturning({ operation: { ...operation, secret: 'unexpected' } });

    await expect(
      invokeBulkOperation(client, { action: 'get', operationId: 'operation-1' }),
    ).rejects.toThrow('invalid response');
  });

  it('rejects leftover Collection Dial undo projections', async () => {
    const { client } = clientReturning({
      operation: {
        ...operation,
        undoOfOperationId: null,
        undoExpiresAt: null,
        undoEligibleCount: 0,
        undoSkippedCount: 0,
        undoConflictCount: 0,
        undoExpired: false,
      },
    });

    await expect(
      invokeBulkOperation(client, { action: 'get', operationId: 'operation-1' }),
    ).rejects.toThrow('invalid response');
  });
});
