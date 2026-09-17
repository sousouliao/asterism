import {
  DEFAULT_EMBEDDING_MODEL,
  type EmbeddableRepo,
  type Memory,
  repoContentHash,
} from '@asterism/core';
import {
  deleteAllRepoEmbeddings,
  listReposToEmbed,
  type StarredRepoRecord,
  upsertRepoEmbedding,
} from '@asterism/db';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from '../auth/use-session';
import { runRepositoryEmbeddingBootstrap } from '../lib/embedding-bootstrap';
import {
  beginEmbeddingPreparation,
  clearEmbeddingConsent,
  finishEmbeddingPreparation,
  readEmbeddingConsent,
  useEmbeddingConsent,
} from '../lib/embedding-consent';
import type { EmbeddingRuntimeBackend } from '../lib/embedding-runtime';
import { supabase } from '../lib/supabase';
import { embeddingKeys } from './keys';

export type EmbeddingBootstrapPhase =
  | 'idle'
  | 'checking'
  | 'loading-model'
  | 'backfilling'
  | 'ready'
  | 'degraded';

export interface EmbeddingBootstrapState {
  phase: EmbeddingBootstrapPhase;
  modelProgress: number;
  completed: number;
  total: number;
  backend: EmbeddingRuntimeBackend | null;
  error: string | null;
}

const INITIAL_STATE: EmbeddingBootstrapState = {
  phase: 'idle',
  modelProgress: 0,
  completed: 0,
  total: 0,
  backend: null,
  error: null,
};

export function useEmbeddingBootstrap(
  records: readonly StarredRepoRecord[],
  memoriesByRepoId?: Map<string, Memory>,
) {
  const { session } = useSession();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const optedIn = useEmbeddingConsent(userId);
  const [state, setState] = useState<EmbeddingBootstrapState>(INITIAL_STATE);
  const [rerunRequested, setRerunRequested] = useState(false);
  const activeUserRef = useRef(userId);
  activeUserRef.current = userId;
  const consentedUserRef = useRef<string | null>(null);
  const generationRef = useRef(0);
  const runningRef = useRef<{
    generation: number;
    promise: Promise<void>;
    userId: string;
  } | null>(null);
  const completedSignatureRef = useRef<string | null>(null);
  const signature = useMemo(
    () =>
      records
        .map((record) => {
          const memory = memoriesByRepoId?.get(record.repoId);
          const embeddable: EmbeddableRepo = {
            fullName: record.repo.fullName,
            description: record.repo.description,
            topics: record.repo.topics,
            whySaved: memory?.whySaved,
            note: memory?.note,
          };
          return `${record.repoId}:${repoContentHash(embeddable)}`;
        })
        .join('|'),
    [records, memoriesByRepoId],
  );
  const signatureRef = useRef(signature);
  signatureRef.current = signature;

  useEffect(() => {
    generationRef.current += 1;
    runningRef.current = null;
    completedSignatureRef.current = null;
    setRerunRequested(false);
    setState(INITIAL_STATE);
    if (!userId) {
      consentedUserRef.current = null;
      return;
    }
    const hasConsent = readEmbeddingConsent(userId);
    consentedUserRef.current = hasConsent ? userId : null;
  }, [userId]);

  const run = useCallback(
    (rememberChoice: boolean) => {
      if (!(userId && records.length > 0)) {
        return Promise.resolve();
      }
      if (rememberChoice) {
        consentedUserRef.current = userId;
      }
      const generation = generationRef.current;
      const running = runningRef.current;
      if (running?.userId === userId && running.generation === generation) {
        return running.promise;
      }

      const currentSignature = signature;
      const preparationToken = beginEmbeddingPreparation(userId, rememberChoice);
      let succeeded = false;
      const isCurrent = () =>
        activeUserRef.current === userId && generationRef.current === generation;
      const updateState = (
        updater: (current: EmbeddingBootstrapState) => EmbeddingBootstrapState,
      ) => {
        if (isCurrent()) {
          setState(updater);
        }
      };
      const task = (async () => {
        updateState(() => ({ ...INITIAL_STATE, phase: 'checking' }));
        try {
          let runtime: Awaited<
            ReturnType<typeof import('../lib/embedding-runtime')['getEmbeddingRuntime']>
          > | null = null;
          const result = await runRepositoryEmbeddingBootstrap({
            records,
            memoriesByRepoId,
            listPending: (desired) =>
              listReposToEmbed(supabase, {
                userId,
                model: DEFAULT_EMBEDDING_MODEL,
                desired,
              }),
            prepare: async (onProgress) => {
              const runtimeModule = await import('../lib/embedding-runtime');
              runtime = runtimeModule.getEmbeddingRuntime();
              return runtime.prepare(onProgress);
            },
            embedBatch: (inputs) => {
              if (!runtime) {
                throw new Error('Embedding runtime was not prepared');
              }
              return runtime.embed(inputs);
            },
            persist: (write) => upsertRepoEmbedding(supabase, { userId, ...write }),
            onPending: (total) =>
              updateState((current) => ({
                ...current,
                phase: total === 0 ? 'ready' : 'loading-model',
                total,
              })),
            onModelProgress: (modelProgress) =>
              updateState((current) => ({ ...current, modelProgress })),
            onPrepared: (backend, total) =>
              updateState((current) => ({
                ...current,
                phase: 'backfilling',
                backend,
                total,
              })),
            onBackfillProgress: ({ completed, total }) =>
              updateState((current) => ({ ...current, completed, total })),
          });
          if (isCurrent()) {
            completedSignatureRef.current = currentSignature;
          }
          await queryClient.invalidateQueries({
            queryKey: embeddingKeys.list(userId),
          });
          succeeded = true;
          updateState((current) => ({
            ...current,
            phase: 'ready',
            backend: result.backend ?? current.backend,
            completed: result.completed,
            total: result.total,
            modelProgress: result.total > 0 ? 100 : current.modelProgress,
            error: null,
          }));
        } catch (error) {
          updateState((current) => ({
            ...current,
            phase: 'degraded',
            error: error instanceof Error ? error.message : String(error),
          }));
        }
      })().finally(() => {
        if (runningRef.current?.promise === task) {
          runningRef.current = null;
        }
        finishEmbeddingPreparation(userId, preparationToken, succeeded);
        if (isCurrent() && signatureRef.current !== currentSignature) {
          setRerunRequested(true);
        }
      });
      runningRef.current = { generation, promise: task, userId };
      return task;
    },
    [memoriesByRepoId, queryClient, records, signature, userId],
  );

  const rebuild = useCallback(async () => {
    if (!userId) {
      return;
    }
    await deleteAllRepoEmbeddings(supabase, userId);
    completedSignatureRef.current = null;
    await queryClient.invalidateQueries({ queryKey: embeddingKeys.list(userId) });
    await run(false);
  }, [queryClient, run, userId]);

  const clear = useCallback(async () => {
    if (!userId) {
      return;
    }
    generationRef.current += 1;
    runningRef.current = null;
    completedSignatureRef.current = null;
    consentedUserRef.current = null;
    await deleteAllRepoEmbeddings(supabase, userId);
    const { clearEmbeddingRuntimeCache } = await import('../lib/embedding-runtime');
    await clearEmbeddingRuntimeCache();
    clearEmbeddingConsent(userId);
    await queryClient.invalidateQueries({ queryKey: embeddingKeys.list(userId) });
    setState(INITIAL_STATE);
  }, [queryClient, userId]);

  useEffect(() => {
    if (
      optedIn &&
      consentedUserRef.current === userId &&
      state.phase !== 'degraded' &&
      records.length > 0 &&
      (rerunRequested || completedSignatureRef.current !== signature) &&
      !(
        runningRef.current?.userId === userId &&
        runningRef.current.generation === generationRef.current
      )
    ) {
      setRerunRequested(false);
      void run(false);
    }
  }, [optedIn, records.length, rerunRequested, run, signature, state.phase, userId]);

  return {
    ...state,
    optedIn,
    start: () => run(true),
    retry: () => run(false),
    rebuild,
    clear,
  };
}
