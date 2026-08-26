import {
  type BulkChange,
  type BulkOperation,
  type BulkOperationCreateSource,
  invokeBulkOperation,
  listBulkOperations,
} from '@asterism/db';
import { toast } from '@asterism/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '../auth/use-session';
import { runBulkOperationUntilSettled } from '../lib/bulk-operation-runner';
import { supabase } from '../lib/supabase';
import { bulkOperationKeys, collectionKeys, collectionRepoKeys } from './keys';

const NO_USER = 'NO_USER';

export function useBulkOperations() {
  const { session } = useSession();
  const userId = session?.user.id;
  return useQuery({
    queryKey: userId ? bulkOperationKeys.list(userId) : bulkOperationKeys.all,
    enabled: Boolean(userId),
    queryFn: () => listBulkOperations(supabase, userId as string),
    refetchInterval: (query) => {
      const operations = query.state.data;
      return operations?.some((operation) => operation.status === 'running') ? 2_000 : false;
    },
  });
}

export function useBulkOperationActions() {
  const { t } = useTranslation();
  const { session } = useSession();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const createRequestIds = useRef(new Map<string, string>());

  const refreshOrganizationData = async () => {
    if (!userId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: bulkOperationKeys.list(userId) }),
      queryClient.invalidateQueries({ queryKey: collectionRepoKeys.list(userId) }),
      queryClient.invalidateQueries({ queryKey: collectionKeys.list(userId) }),
    ]);
  };

  const runUntilSettled = (
    operation: BulkOperation,
    action: 'execute' | 'retry',
    runnableStatus: 'pending' | 'retryable_failed',
  ) =>
    runBulkOperationUntilSettled(operation.id, action, runnableStatus, (request) =>
      invokeBulkOperation(supabase, request),
    );

  const create = useMutation({
    // 只创建操作；执行由横幅接管（onSuccess 里触发 resume），不在对话框内阻塞
    mutationFn: async (input: {
      repoIds: string[];
      changes: BulkChange[];
      source?: BulkOperationCreateSource;
    }) => {
      if (!userId) throw new Error(NO_USER);
      const requestKey = JSON.stringify(input);
      const clientRequestId = createRequestIds.current.get(requestKey) ?? crypto.randomUUID();
      createRequestIds.current.set(requestKey, clientRequestId);
      return invokeBulkOperation(supabase, {
        action: 'create',
        source: input.source ?? 'manual',
        interaction: 'bulk_dialog',
        clientRequestId,
        repoIds: input.repoIds,
        changes: input.changes,
      });
    },
    onSettled: refreshOrganizationData,
    onSuccess: (operation, input) => {
      createRequestIds.current.delete(JSON.stringify(input));
      if (operation.status === 'completed') toast.success(t('bulk.status.completed'));
    },
    onError: () => toast.error(t('bulk.createError')),
  });

  const runOperation = (action: 'complete', operation: BulkOperation) => {
    if (!userId) return Promise.reject(new Error(NO_USER));
    return invokeBulkOperation(supabase, { action, operationId: operation.id });
  };
  const resume = useMutation({
    mutationFn: (operation: BulkOperation) => runUntilSettled(operation, 'execute', 'pending'),
    onSettled: refreshOrganizationData,
    onSuccess: (operation) => {
      if (operation.status === 'completed') toast.success(t('bulk.status.completed'));
    },
    onError: () => toast.error(t('bulk.actionError')),
  });
  const retry = useMutation({
    mutationFn: (operation: BulkOperation) =>
      runUntilSettled(operation, 'retry', 'retryable_failed'),
    onSettled: refreshOrganizationData,
    onSuccess: (operation) => {
      if (operation.status === 'completed') toast.success(t('bulk.status.completed'));
    },
    onError: () => toast.error(t('bulk.actionError')),
  });
  const complete = useMutation({
    mutationFn: (operation: BulkOperation) => runOperation('complete', operation),
    onSettled: refreshOrganizationData,
    onSuccess: () => toast.success(t('bulk.status.completed')),
    onError: () => toast.error(t('bulk.actionError')),
  });

  return { create, resume, retry, complete };
}
