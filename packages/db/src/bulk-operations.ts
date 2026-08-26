import type { SupabaseClient } from './client';
import type { Tables } from './database.types';

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

export type BulkOperationSource = 'manual' | 'promotion';
export type BulkOperationCreateSource = 'manual';
export type BulkOperationInteraction = 'bulk_dialog';
export type BulkOperationCreateInteraction = BulkOperationInteraction;

export interface BulkOperation {
  id: string;
  source: BulkOperationSource;
  interaction: BulkOperationInteraction;
  clientRequestId: string;
  sourceRepoIds: string[];
  status: BulkOperationStatus;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: BulkOperationItem[];
}

export type BulkOperationRequest =
  | {
      action: 'create';
      source: BulkOperationCreateSource;
      interaction: 'bulk_dialog';
      clientRequestId: string;
      repoIds: string[];
      changes: BulkChange[];
    }
  | { action: 'get' | 'execute' | 'retry' | 'complete'; operationId: string };

const operationStatuses = new Set<BulkOperationStatus>([
  'pending',
  'running',
  'needs_attention',
  'completed',
]);
const itemStatuses = new Set<BulkItemStatus>([
  'pending',
  'running',
  'succeeded',
  'retryable_failed',
  'terminal_failed',
  'dismissed',
]);

function isStringOrNull(value: unknown): value is string | null {
  return typeof value === 'string' || value === null;
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

function isBulkItem(value: unknown): value is BulkOperationItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    hasExactKeys(item, [
      'id',
      'repoId',
      'relationType',
      'targetId',
      'action',
      'status',
      'attemptCount',
      'lastErrorCode',
      'lastErrorMessage',
      'effectiveChanged',
      'effectiveMutationId',
      'effectiveRelationVersion',
    ]) &&
    typeof item.id === 'string' &&
    typeof item.repoId === 'string' &&
    (item.relationType === 'tag' || item.relationType === 'collection') &&
    typeof item.targetId === 'string' &&
    (item.action === 'add' || item.action === 'remove') &&
    itemStatuses.has(item.status as BulkItemStatus) &&
    typeof item.attemptCount === 'number' &&
    isStringOrNull(item.lastErrorCode) &&
    isStringOrNull(item.lastErrorMessage) &&
    typeof item.effectiveChanged === 'boolean' &&
    isStringOrNull(item.effectiveMutationId) &&
    (typeof item.effectiveRelationVersion === 'number' || item.effectiveRelationVersion === null) &&
    (item.effectiveChanged || item.effectiveMutationId === null)
  );
}

const validSources = new Set<BulkOperationSource>(['manual', 'promotion']);
const validInteractions = new Set<BulkOperationInteraction>(['bulk_dialog']);

function isBulkOperation(value: unknown): value is BulkOperation {
  if (!value || typeof value !== 'object') return false;
  const operation = value as Record<string, unknown>;
  return (
    hasExactKeys(operation, [
      'id',
      'source',
      'interaction',
      'clientRequestId',
      'sourceRepoIds',
      'status',
      'completedAt',
      'createdAt',
      'updatedAt',
      'items',
    ]) &&
    typeof operation.id === 'string' &&
    validSources.has(operation.source as BulkOperationSource) &&
    validInteractions.has(operation.interaction as BulkOperationInteraction) &&
    isUuid(operation.clientRequestId) &&
    Array.isArray(operation.sourceRepoIds) &&
    operation.sourceRepoIds.every((id) => typeof id === 'string') &&
    operationStatuses.has(operation.status as BulkOperationStatus) &&
    isStringOrNull(operation.completedAt) &&
    typeof operation.createdAt === 'string' &&
    typeof operation.updatedAt === 'string' &&
    Array.isArray(operation.items) &&
    operation.items.every(isBulkItem)
  );
}

type BulkOperationItemRow = Pick<
  Tables<'bulk_operation_items'>,
  | 'id'
  | 'repo_id'
  | 'relation_type'
  | 'target_id'
  | 'action'
  | 'status'
  | 'attempt_count'
  | 'last_error_code'
  | 'last_error_message'
  | 'effective_changed'
  | 'effective_mutation_id'
  | 'effective_relation_version'
>;

function mapItem(row: BulkOperationItemRow): BulkOperationItem {
  return {
    id: row.id,
    repoId: row.repo_id,
    relationType: row.relation_type,
    targetId: row.target_id,
    action: row.action,
    status: row.status,
    attemptCount: row.attempt_count,
    lastErrorCode: row.last_error_code,
    lastErrorMessage: row.last_error_message,
    effectiveChanged: row.effective_changed,
    effectiveMutationId: row.effective_mutation_id,
    effectiveRelationVersion: row.effective_relation_version,
  };
}

export async function invokeBulkOperation(
  client: SupabaseClient,
  request: BulkOperationRequest,
): Promise<BulkOperation> {
  const { data, error } = await client.functions.invoke<unknown>('bulk-organize', {
    body: request,
  });
  if (error) throw error;
  const response = data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  const operation = response?.operation;
  if (!response || !hasExactKeys(response, ['operation']) || !isBulkOperation(operation)) {
    throw new Error('bulk-organize returned an invalid response');
  }
  return operation;
}

export async function listBulkOperations(
  client: SupabaseClient,
  userId: string,
): Promise<BulkOperation[]> {
  const { data: operations, error: operationsError } = await client
    .from('bulk_operations')
    .select(
      'id, source, interaction, client_request_id, source_repo_ids, status, completed_at, created_at, updated_at',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (operationsError) throw operationsError;
  const operationIds = (operations ?? []).map((operation) => operation.id);
  if (operationIds.length === 0) return [];

  const { data: items, error: itemsError } = await client
    .from('bulk_operation_items')
    .select(
      'id, operation_id, repo_id, relation_type, target_id, action, status, attempt_count, last_error_code, last_error_message, effective_changed, effective_mutation_id, effective_relation_version, created_at',
    )
    .eq('user_id', userId)
    .in('operation_id', operationIds)
    .order('created_at');
  if (itemsError) throw itemsError;
  const itemsByOperation = new Map<string, BulkOperationItem[]>();
  for (const row of items ?? []) {
    const mapped = mapItem(row);
    const current = itemsByOperation.get(row.operation_id);
    if (current) current.push(mapped);
    else itemsByOperation.set(row.operation_id, [mapped]);
  }

  return (operations ?? []).map((row) => ({
    id: row.id,
    source: row.source,
    interaction: row.interaction,
    clientRequestId: row.client_request_id,
    sourceRepoIds: row.source_repo_ids,
    status: row.status,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: itemsByOperation.get(row.id) ?? [],
  }));
}
