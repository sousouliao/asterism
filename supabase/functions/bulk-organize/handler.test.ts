import { describe, expect, it, vi } from 'vitest';
import {
  type BulkOperation,
  type BulkOrganizeDependencies,
  createBulkOrganizeHandler,
} from './handler';

const operation: BulkOperation = {
  id: 'operation-1',
  source: 'manual',
  interaction: 'bulk_dialog',
  clientRequestId: '11111111-1111-4111-8111-111111111111',
  sourceRepoIds: ['repo-1', 'repo-2'],
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

function dependencies(overrides: Partial<BulkOrganizeDependencies> = {}): BulkOrganizeDependencies {
  return {
    authenticate: vi.fn().mockResolvedValue('user-1'),
    createOperation: vi.fn().mockResolvedValue(operation),
    getOperation: vi.fn().mockResolvedValue(operation),
    executeOperation: vi.fn().mockResolvedValue(operation),
    retryOperation: vi.fn().mockResolvedValue(operation),
    completeOperation: vi.fn().mockResolvedValue(operation),
    ...overrides,
  };
}

function request(body: unknown, authorized = true) {
  return new Request('https://example.test/bulk-organize', {
    method: 'POST',
    headers: authorized
      ? { Authorization: 'Bearer session-jwt', 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function outcome(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe('bulk-organize trusted HTTP interface', () => {
  it('creates a stable, de-duplicated repository scope with normalized relationship changes', async () => {
    const deps = dependencies();

    const response = await createBulkOrganizeHandler(deps)(
      request({
        action: 'create',
        source: 'manual',
        interaction: 'bulk_dialog',
        clientRequestId: '11111111-1111-4111-8111-111111111111',
        repoIds: ['repo-2', 'repo-1', 'repo-2'],
        changes: [
          { relationType: 'collection', targetId: 'collection-1', action: 'add' },
          { relationType: 'collection', targetId: 'collection-1', action: 'add' },
          { relationType: 'collection', targetId: 'collection-2', action: 'remove' },
        ],
      }),
    );

    expect(response.status).toBe(200);
    expect(deps.createOperation).toHaveBeenCalledWith('user-1', {
      source: 'manual',
      interaction: 'bulk_dialog',
      clientRequestId: '11111111-1111-4111-8111-111111111111',
      repoIds: ['repo-2', 'repo-1'],
      changes: [
        { relationType: 'collection', targetId: 'collection-1', action: 'add' },
        { relationType: 'collection', targetId: 'collection-2', action: 'remove' },
      ],
    });
    expect(await outcome(response)).toEqual({ operation });
  });

  it('rejects Collection Dial create and undo requests after retirement', async () => {
    const deps = dependencies();
    const handler = createBulkOrganizeHandler(deps);

    for (const body of [
      {
        action: 'create',
        source: 'manual',
        interaction: 'collection_dial',
        clientRequestId: '11111111-1111-4111-8111-111111111111',
        repoIds: ['repo-1', 'repo-2', 'repo-3'],
        itemRepoIds: ['repo-2', 'repo-3'],
        changes: [{ relationType: 'collection', targetId: 'collection-1', action: 'add' }],
      },
      {
        action: 'undo',
        operationId: 'operation-1',
        clientRequestId: '22222222-2222-4222-8222-222222222222',
      },
    ]) {
      const response = await handler(request(body));
      expect(response.status).toBe(400);
    }
    expect(deps.createOperation).not.toHaveBeenCalled();
  });

  it('rejects new operations that still name relationType tag', async () => {
    const deps = dependencies();
    const response = await createBulkOrganizeHandler(deps)(
      request({
        action: 'create',
        source: 'manual',
        interaction: 'bulk_dialog',
        clientRequestId: '11111111-1111-4111-8111-111111111111',
        repoIds: ['repo-1'],
        changes: [{ relationType: 'tag', targetId: 'tag-1', action: 'add' }],
      }),
    );

    expect(response.status).toBe(400);
    expect(deps.createOperation).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated requests', async () => {
    const deps = dependencies();
    const handler = createBulkOrganizeHandler(deps);

    expect(
      (await handler(request({ action: 'get', operationId: 'operation-1' }, false))).status,
    ).toBe(401);
    expect(
      (
        await handler(
          request({
            action: 'create',
            source: 'manual',
            interaction: 'bulk_dialog',
            clientRequestId: '11111111-1111-4111-8111-111111111111',
            repoIds: [],
            changes: [{ relationType: 'collection', targetId: 'collection-1', action: 'add' }],
          }),
        )
      ).status,
    ).toBe(400);
    expect(deps.createOperation).not.toHaveBeenCalled();
    expect(deps.getOperation).not.toHaveBeenCalled();
  });

  it.each([
    {
      action: 'create',
      source: 'manual',
      interaction: 'bulk_dialog',
      clientRequestId: '11111111-1111-4111-8111-111111111111',
      repoIds: ['repo-1'],
      changes: [{ relationType: 'collection', targetId: 'collection-1', action: 'add' }],
      unexpected: true,
    },
    {
      action: 'create',
      source: 'manual',
      interaction: 'bulk_dialog',
      clientRequestId: '11111111-1111-4111-8111-111111111111',
      repoIds: ['repo-1'],
      changes: [
        { relationType: 'collection', targetId: 'collection-1', action: 'add', unexpected: true },
      ],
    },
  ])('rejects unknown create request fields', async (body) => {
    const deps = dependencies();

    const response = await createBulkOrganizeHandler(deps)(request(body));

    expect(response.status).toBe(400);
    expect(deps.createOperation).not.toHaveBeenCalled();
  });

  it.each([
    ['get', 'getOperation'],
    ['execute', 'executeOperation'],
    ['retry', 'retryOperation'],
    ['complete', 'completeOperation'],
  ] as const)('routes %s through an ownership-scoped dependency', async (action, method) => {
    const deps = dependencies();

    const response = await createBulkOrganizeHandler(deps)(
      request({ action, operationId: 'operation-1' }),
    );

    expect(response.status).toBe(200);
    expect(deps[method]).toHaveBeenCalledWith('user-1', 'operation-1');
    expect(await outcome(response)).toEqual({ operation });
  });

  it('does not reveal whether another user owns a missing operation', async () => {
    const deps = dependencies({ getOperation: vi.fn().mockResolvedValue(null) });

    const response = await createBulkOrganizeHandler(deps)(
      request({ action: 'get', operationId: 'operation-from-another-user' }),
    );

    expect(response.status).toBe(404);
    expect(await outcome(response)).toEqual({ error: 'operation_not_found' });
  });
});
