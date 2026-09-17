import { type NormalizedImportData, normalizeClassificationName } from '@asterism/core';
import type { SupabaseClient } from './client';
import { mutateCollectionRelation } from './queries/collection-repos';
import { createCollection, listCollections } from './queries/collections';
import { saveMemory } from './queries/memories';
import { listStarredRepos } from './queries/repos';

export interface ImportUserDataResult {
  ok: boolean;
  imported: {
    collections: number;
    collectionRepos: number;
    memories: number;
  };
  skipped: string[];
  errors: string[];
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  );
}

/**
 * 按依赖顺序导入组织数据（collections → 关联 → memories）。
 * 仓库须已存在于 user_stars；按 fullName 匹配，无法匹配则跳过。
 */
export async function importUserData(
  client: SupabaseClient,
  userId: string,
  data: NormalizedImportData,
  collectionRequestId: (collectionId: string, repoId: string) => string,
): Promise<ImportUserDataResult> {
  const skipped: string[] = [];
  const errors: string[] = [];
  const imported = {
    collections: 0,
    collectionRepos: 0,
    memories: 0,
  };

  const starred = await listStarredRepos(client, userId);
  const repoByFullName = new Map(
    starred.map((record) => [record.repo.fullName.toLowerCase(), record.repoId]),
  );

  const existingCollections = await listCollections(client, userId);
  const collectionByName = new Map(
    existingCollections.map((collection) => [
      normalizeClassificationName(collection.name),
      collection.id,
    ]),
  );

  for (const collection of data.collections) {
    const key = normalizeClassificationName(collection.name);
    if (collectionByName.has(key)) {
      skipped.push(`Collection exists: ${collection.name}`);
      continue;
    }
    try {
      const created = await createCollection(client, {
        userId,
        name: collection.name,
        description: collection.description,
      });
      collectionByName.set(key, created.id);
      imported.collections += 1;
    } catch (error) {
      if (isUniqueViolation(error)) {
        skipped.push(`Collection exists: ${collection.name}`);
      } else {
        errors.push(`Collection failed: ${collection.name}`);
      }
    }
  }

  for (const link of data.collectionRepos) {
    const repoId = repoByFullName.get(link.fullName.toLowerCase());
    const collectionId = collectionByName.get(normalizeClassificationName(link.collectionName));
    if (!repoId) {
      skipped.push(`Repo not starred: ${link.fullName}`);
      continue;
    }
    if (!collectionId) {
      skipped.push(`Collection missing: ${link.collectionName}`);
      continue;
    }
    try {
      const mutation = await mutateCollectionRelation(client, {
        collectionId,
        repoId,
        action: 'add',
        clientRequestId: collectionRequestId(collectionId, repoId),
      });
      if (mutation.effectiveChanged) imported.collectionRepos += 1;
      else skipped.push(`Collection member exists: ${link.collectionName} / ${link.fullName}`);
    } catch (error) {
      if (isUniqueViolation(error)) {
        skipped.push(`Collection member exists: ${link.collectionName} / ${link.fullName}`);
      } else {
        errors.push(`Collection member failed: ${link.collectionName} / ${link.fullName}`);
      }
    }
  }

  for (const memory of data.memories) {
    const repoId = repoByFullName.get(memory.fullName.toLowerCase());
    if (!repoId) {
      skipped.push(`Repo not starred: ${memory.fullName}`);
      continue;
    }
    try {
      await saveMemory(client, {
        userId,
        repoId,
        whySaved: memory.whySaved ?? '',
        note: memory.note ?? '',
      });
      imported.memories += 1;
    } catch {
      errors.push(`Memory failed: ${memory.fullName}`);
    }
  }

  return {
    ok: errors.length === 0,
    imported,
    skipped,
    errors,
  };
}
