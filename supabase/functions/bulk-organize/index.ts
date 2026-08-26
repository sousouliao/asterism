import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { Database, Json } from '../../../packages/db/src/database.types.ts';
import {
  type BulkExecutionResult,
  type BulkExecutionStore,
  executeBulkOperation,
} from './executor.ts';
import {
  type BulkOperation,
  type BulkOperationItem,
  type CreateBulkOperationInput,
  createBulkOrganizeHandler,
} from './handler.ts';
import {
  applyRelationship,
  type RelationshipStore,
  throwCollectionMutationError,
} from './relationships.ts';

type AdminClient = ReturnType<typeof createClient<Database>>;

function mapItem(row: Record<string, unknown>): BulkOperationItem {
  return {
    id: String(row.id),
    repoId: String(row.repo_id),
    relationType: row.relation_type as BulkOperationItem['relationType'],
    targetId: String(row.target_id),
    action: row.action as BulkOperationItem['action'],
    status: row.status as BulkOperationItem['status'],
    attemptCount: Number(row.attempt_count),
    lastErrorCode: typeof row.last_error_code === 'string' ? row.last_error_code : null,
    lastErrorMessage: typeof row.last_error_message === 'string' ? row.last_error_message : null,
    effectiveChanged: row.effective_changed === true,
    effectiveMutationId:
      typeof row.effective_mutation_id === 'string' ? row.effective_mutation_id : null,
    effectiveRelationVersion:
      typeof row.effective_relation_version === 'number' ? row.effective_relation_version : null,
  };
}

async function getOperation(
  admin: AdminClient,
  userId: string,
  operationId: string,
): Promise<BulkOperation | null> {
  const [operationResult, itemsResult] = await Promise.all([
    admin
      .from('bulk_operations')
      .select(
        'id, source, interaction, client_request_id, source_repo_ids, status, completed_at, created_at, updated_at',
      )
      .eq('id', operationId)
      .eq('user_id', userId)
      .maybeSingle(),
    admin
      .from('bulk_operation_items')
      .select(
        'id, repo_id, relation_type, target_id, action, status, attempt_count, last_error_code, last_error_message, effective_changed, effective_mutation_id, effective_relation_version',
      )
      .eq('operation_id', operationId)
      .eq('user_id', userId)
      .order('created_at'),
  ]);
  if (operationResult.error || itemsResult.error) {
    throw new Error('bulk_operation_read_failed');
  }
  const row = operationResult.data as Record<string, unknown> | null;
  if (!row) {
    return null;
  }
  return {
    id: String(row.id),
    source: row.source as BulkOperation['source'],
    interaction: row.interaction as BulkOperation['interaction'],
    clientRequestId: String(row.client_request_id),
    sourceRepoIds: (row.source_repo_ids as string[]) ?? [],
    status: row.status as BulkOperation['status'],
    completedAt: typeof row.completed_at === 'string' ? row.completed_at : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    items: ((itemsResult.data ?? []) as Record<string, unknown>[]).map(mapItem),
  };
}

function createExecutionStore(admin: AdminClient): BulkExecutionStore {
  const relationships: RelationshipStore = {
    ownsRepository: async (userId, repoId) => {
      const { data, error } = await admin
        .from('user_stars')
        .select('id')
        .eq('user_id', userId)
        .eq('repo_id', repoId)
        .maybeSingle();
      if (error) throw new Error('membership_check_failed');
      return Boolean(data);
    },
    ownsTarget: async (userId, _relationType, targetId) => {
      const result = await admin
        .from('collections')
        .select('id')
        .eq('id', targetId)
        .eq('user_id', userId)
        .maybeSingle();
      if (result.error) throw new Error('target_check_failed');
      return Boolean(result.data);
    },
    mutateCollectionRelationship: async (userId, item) => {
      const { data, error } = await admin.rpc('apply_collection_relation_mutation', {
        p_user_id: userId,
        p_collection_id: item.targetId,
        p_repo_id: item.repoId,
        p_action: item.action,
        p_operation_item_id: item.id,
      });
      if (error) {
        throwCollectionMutationError(error);
      }
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('relationship_write_failed');
      }
      const result = data as Record<string, unknown>;
      if (
        typeof result.effectiveChanged !== 'boolean' ||
        (typeof result.effectiveMutationId !== 'string' && result.effectiveMutationId !== null) ||
        typeof result.relationVersion !== 'number'
      ) {
        throw new Error('relationship_write_failed');
      }
      return {
        effectiveChanged: result.effectiveChanged,
        effectiveMutationId: result.effectiveMutationId,
        effectiveRelationVersion: result.relationVersion,
      };
    },
  };

  return {
    claimItems: async (userId, operationId, statuses) => {
      const { data, error } = await admin.rpc('claim_bulk_operation_items', {
        p_user_id: userId,
        p_operation_id: operationId,
        p_statuses: statuses,
      });
      if (error) throw new Error('bulk_operation_claim_failed');
      return ((data ?? []) as Record<string, unknown>[]).map(mapItem);
    },
    applyItem: (userId, item) => applyRelationship(relationships, userId, item),
    recordItemResult: async (userId, itemId, result: BulkExecutionResult) => {
      const { error } = await admin.rpc('record_bulk_operation_item_result', {
        p_user_id: userId,
        p_item_id: itemId,
        p_status: result.status,
        p_error_code: result.errorCode,
        p_error_message: result.errorMessage,
        p_effective_changed: result.effectiveChanged,
        p_effective_mutation_id: result.effectiveMutationId,
        p_effective_relation_version: result.effectiveRelationVersion,
      });
      if (error) throw new Error('bulk_operation_result_write_failed');
    },
    refreshOperation: (userId, operationId) => getOperation(admin, userId, operationId),
  };
}

Deno.serve(async (request: Request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'server_configuration_missing' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const executionStore = createExecutionStore(admin);
  const handler = createBulkOrganizeHandler({
    authenticate: async (jwt) => {
      const { data, error } = await admin.auth.getUser(jwt);
      return error ? null : (data.user?.id ?? null);
    },
    createOperation: async (userId, input: CreateBulkOperationInput) => {
      const { data, error } = await admin.rpc('create_bulk_operation', {
        p_user_id: userId,
        p_source: input.source,
        p_interaction: input.interaction,
        p_client_request_id: input.clientRequestId,
        p_repo_ids: input.repoIds,
        p_changes: input.changes.map(
          (change): Json => ({
            relationType: change.relationType,
            targetId: change.targetId,
            action: change.action,
          }),
        ),
      });
      if (error || typeof data !== 'string') {
        const message = error?.message ?? 'bulk_operation_create_failed';
        if (message.includes('repository_not_owned')) throw new Error('repository_not_owned');
        if (message.includes('target_not_owned')) throw new Error('target_not_owned');
        throw new Error('bulk_operation_create_failed');
      }
      const operation = await getOperation(admin, userId, data);
      if (!operation) throw new Error('bulk_operation_create_failed');
      return operation;
    },
    getOperation: (userId, operationId) => getOperation(admin, userId, operationId),
    executeOperation: (userId, operationId) =>
      executeBulkOperation(executionStore, userId, operationId, 'pending'),
    retryOperation: (userId, operationId) =>
      executeBulkOperation(executionStore, userId, operationId, 'retryable'),
    completeOperation: async (userId, operationId) => {
      const { error } = await admin.rpc('complete_bulk_operation', {
        p_user_id: userId,
        p_operation_id: operationId,
      });
      if (error) throw new Error('bulk_operation_complete_failed');
      return getOperation(admin, userId, operationId);
    },
  });

  return handler(request);
});
