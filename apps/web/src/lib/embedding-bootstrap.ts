import {
  DEFAULT_EMBEDDING_MODEL,
  type DesiredRepoEmbedding,
  type EmbeddableRepo,
  type EmbeddingBackfillProgress,
  type Memory,
  type RepoEmbeddingBackfillItem,
  repoContentHash,
  runEmbeddingBackfill,
  toPassageInput,
} from '@asterism/core';
import type { StarredRepoRecord } from '@asterism/db';
import type { EmbeddingRuntimeBackend } from './embedding-runtime';

export interface RepoEmbeddingWrite {
  repoId: string;
  embedding: number[];
  embeddingModel: string;
  contentHash: string;
}

export interface RepositoryEmbeddingBootstrapResult extends EmbeddingBackfillProgress {
  backend: EmbeddingRuntimeBackend | null;
}

function toEmbeddableRepo(record: StarredRepoRecord, memory?: Memory): EmbeddableRepo {
  return {
    fullName: record.repo.fullName,
    description: record.repo.description,
    topics: record.repo.topics,
    whySaved: memory?.whySaved,
    note: memory?.note,
  };
}

export async function runRepositoryEmbeddingBootstrap(input: {
  records: readonly StarredRepoRecord[];
  memoriesByRepoId?: Map<string, Memory>;
  listPending: (desired: readonly DesiredRepoEmbedding[]) => Promise<RepoEmbeddingBackfillItem[]>;
  prepare: (onProgress?: (progress: number) => void) => Promise<{
    backend: EmbeddingRuntimeBackend;
  }>;
  embedBatch: (inputs: readonly string[]) => Promise<readonly number[][]>;
  persist: (write: RepoEmbeddingWrite) => Promise<void>;
  onModelProgress?: (progress: number) => void;
  onPending?: (total: number) => void;
  onPrepared?: (backend: EmbeddingRuntimeBackend, total: number) => void;
  onBackfillProgress?: (progress: EmbeddingBackfillProgress) => void;
}): Promise<RepositoryEmbeddingBootstrapResult> {
  const recordsById = new Map(input.records.map((record) => [record.repoId, record]));
  const desired = input.records.map((record) => {
    const memory = input.memoriesByRepoId?.get(record.repoId);
    const embeddable = toEmbeddableRepo(record, memory);
    return {
      repoId: record.repoId,
      contentHash: repoContentHash(embeddable),
    };
  });
  const pending = await input.listPending(desired);
  input.onPending?.(pending.length);
  if (pending.length === 0) {
    return { backend: null, completed: 0, total: 0 };
  }

  const targets = pending.flatMap((item) => {
    const record = recordsById.get(item.repoId);
    if (!record) {
      return [];
    }
    const memory = input.memoriesByRepoId?.get(record.repoId);
    const embeddable = toEmbeddableRepo(record, memory);
    return [
      {
        repoId: record.repoId,
        contentHash: repoContentHash(embeddable),
        input: toPassageInput(embeddable),
      },
    ];
  });
  const { backend } = await input.prepare(input.onModelProgress);
  input.onPrepared?.(backend, targets.length);
  const progress = await runEmbeddingBackfill({
    targets,
    embedBatch: input.embedBatch,
    persist: (target, embedding) =>
      input.persist({
        repoId: target.repoId,
        embedding,
        embeddingModel: DEFAULT_EMBEDDING_MODEL,
        contentHash: target.contentHash,
      }),
    onProgress: input.onBackfillProgress,
  });

  return { backend, ...progress };
}
