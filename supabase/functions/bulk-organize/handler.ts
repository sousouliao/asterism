const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export type BulkRelationType = 'tag' | 'collection';
export type BulkRelationAction = 'add' | 'remove';
export type BulkItemStatus =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'retryable_failed'
  | 'terminal_failed'
  | 'dismissed';
export type BulkOperationStatus = 'pending' | 'running' | 'needs_attention' | 'completed';

export interface BulkChange {
  relationType: BulkRelationType;
  targetId: string;
  action: BulkRelationAction;
}

export interface BulkOperationItem extends BulkChange {
  id: string;
  repoId: string;
  status: BulkItemStatus;
  attemptCount: number;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  effectiveChanged: boolean;
  effectiveMutationId: string | null;
  effectiveRelationVersion: number | null;
}

export type BulkOperationInteraction = 'bulk_dialog';
export type BulkOperationCreateInteraction = BulkOperationInteraction;

export interface BulkOperation {
  id: string;
  source: 'manual' | 'promotion';
  interaction: BulkOperationInteraction;
  clientRequestId: string;
  sourceRepoIds: string[];
  status: BulkOperationStatus;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: BulkOperationItem[];
}

export interface CreateBulkOperationInput {
  source: 'manual';
  interaction: BulkOperationCreateInteraction;
  clientRequestId: string;
  repoIds: string[];
  changes: BulkChange[];
}

export interface BulkOrganizeDependencies {
  authenticate: (jwt: string) => Promise<string | null>;
  createOperation: (userId: string, input: CreateBulkOperationInput) => Promise<BulkOperation>;
  getOperation: (userId: string, operationId: string) => Promise<BulkOperation | null>;
  executeOperation: (userId: string, operationId: string) => Promise<BulkOperation | null>;
  retryOperation: (userId: string, operationId: string) => Promise<BulkOperation | null>;
  completeOperation: (userId: string, operationId: string) => Promise<BulkOperation | null>;
}

type OperationAction = 'get' | 'execute' | 'retry' | 'complete';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128;
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
}

function isCreateInteraction(value: unknown): value is BulkOperationCreateInteraction {
  return value === 'bulk_dialog';
}

function normalizeCreateInput(value: unknown): CreateBulkOperationInput | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const input = value as Record<string, unknown>;
  const interaction = input.interaction;
  if (
    !hasExactKeys(input, [
      'action',
      'source',
      'interaction',
      'clientRequestId',
      'repoIds',
      'changes',
    ]) ||
    input.action !== 'create' ||
    input.source !== 'manual' ||
    !isCreateInteraction(interaction) ||
    !isUuid(input.clientRequestId) ||
    !Array.isArray(input.repoIds) ||
    !Array.isArray(input.changes)
  ) {
    return null;
  }
  const repoIds = [...new Set(input.repoIds.filter(isId))];
  if (repoIds.length === 0 || repoIds.length !== new Set(input.repoIds).size) {
    return null;
  }

  const changes: BulkChange[] = [];
  const changeKeys = new Set<string>();
  for (const candidate of input.changes) {
    if (!candidate || typeof candidate !== 'object') {
      return null;
    }
    const change = candidate as Record<string, unknown>;
    if (
      !hasExactKeys(change, ['relationType', 'targetId', 'action']) ||
      change.relationType !== 'collection' ||
      (change.action !== 'add' && change.action !== 'remove') ||
      !isId(change.targetId)
    ) {
      return null;
    }
    const key = `${change.relationType}:${change.targetId}:${change.action}`;
    if (!changeKeys.has(key)) {
      changeKeys.add(key);
      changes.push({
        relationType: change.relationType,
        targetId: change.targetId,
        action: change.action,
      });
    }
  }
  if (changes.length === 0 || repoIds.length * changes.length > 10_000) {
    return null;
  }
  return {
    source: input.source,
    interaction,
    clientRequestId: input.clientRequestId,
    repoIds,
    changes,
  };
}

function operationRequest(value: unknown): { action: OperationAction; operationId: string } | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const input = value as Record<string, unknown>;
  if (
    !hasExactKeys(input, ['action', 'operationId']) ||
    !['get', 'execute', 'retry', 'complete'].includes(String(input.action)) ||
    !isId(input.operationId)
  ) {
    return null;
  }
  return { action: input.action as OperationAction, operationId: input.operationId };
}

export function createBulkOrganizeHandler(dependencies: BulkOrganizeDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }
    if (request.method !== 'POST') {
      return json({ error: 'method_not_allowed' }, 405);
    }

    const jwt = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    if (!jwt) {
      return json({ error: 'authentication_required' }, 401);
    }
    let userId: string | null = null;
    try {
      userId = await dependencies.authenticate(jwt);
    } catch {
      userId = null;
    }
    if (!userId) {
      return json({ error: 'authentication_required' }, 401);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'invalid_request' }, 400);
    }

    try {
      if ((body as Record<string, unknown> | null)?.action === 'create') {
        const input = normalizeCreateInput(body);
        if (!input) {
          return json({ error: 'invalid_request' }, 400);
        }
        return json({ operation: await dependencies.createOperation(userId, input) });
      }

      const input = operationRequest(body);
      if (!input) {
        return json({ error: 'invalid_request' }, 400);
      }
      const operation = await dependencies[`${input.action}Operation`](userId, input.operationId);
      return operation ? json({ operation }) : json({ error: 'operation_not_found' }, 404);
    } catch (error) {
      const code = error instanceof Error ? error.message : 'bulk_operation_failed';
      const status = code.startsWith('invalid_') || code.endsWith('_not_owned') ? 400 : 500;
      return json({ error: code }, status);
    }
  };
}
