import type { Memory } from '@asterism/core';
import type { SupabaseClient } from '../client';

const MEMORY_COLUMNS = 'repo_id, source, source_created_at, why_saved, note';
const PAGE_SIZE = 1_000;

type MemoryRow = {
  repo_id: unknown;
  source: unknown;
  source_created_at: unknown;
  why_saved: unknown;
  note: unknown;
};

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function mapMemoryRow(value: MemoryRow): Memory {
  if (
    typeof value.repo_id !== 'string' ||
    value.source !== 'github_star' ||
    !nullableString(value.source_created_at) ||
    !nullableString(value.why_saved) ||
    !nullableString(value.note)
  ) {
    throw new Error('INVALID_MEMORY_RESPONSE');
  }

  return {
    repoId: value.repo_id,
    source: value.source,
    sourceCreatedAt: value.source_created_at,
    whySaved: value.why_saved,
    note: value.note,
  };
}

/** 读取当前用户的全部 Memory，供导出与列表上下文使用。 */
export async function listMemories(client: SupabaseClient, userId: string): Promise<Memory[]> {
  const memories: Memory[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from('memories')
      .select(MEMORY_COLUMNS)
      .eq('user_id', userId)
      .order('repo_id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    const rows = data ?? [];
    memories.push(...rows.map((row) => mapMemoryRow(row)));
    if (rows.length < PAGE_SIZE) {
      return memories;
    }
  }
}

/** 读取当前用户所有含非空 Note 的仓库 ID，供列表状态展示。 */
export async function listMemoryNoteRepoIds(
  client: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const repoIds: string[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from('memories')
      .select('repo_id, note')
      .eq('user_id', userId)
      .not('note', 'is', null)
      .order('repo_id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    const rows = data ?? [];
    repoIds.push(
      ...rows.flatMap((row) =>
        typeof row.repo_id === 'string' && typeof row.note === 'string' && row.note.trim()
          ? [row.repo_id]
          : [],
      ),
    );
    if (rows.length < PAGE_SIZE) {
      return repoIds;
    }
  }
}

/** 读取某仓库的 Memory；尚无基础记录时返回 null。 */
export async function getMemory(
  client: SupabaseClient,
  input: { userId: string; repoId: string },
): Promise<Memory | null> {
  const { data, error } = await client
    .from('memories')
    .select(MEMORY_COLUMNS)
    .eq('user_id', input.userId)
    .eq('repo_id', input.repoId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapMemoryRow(data) : null;
}

function normalizeText(value: string): string | null {
  return value.trim() || null;
}

/** 保存个人上下文；清空字段写为 null，基础 Memory 始终保留。 */
export async function saveMemory(
  client: SupabaseClient,
  input: { userId: string; repoId: string; whySaved: string; note: string },
): Promise<Memory> {
  const personalFields = {
    why_saved: normalizeText(input.whySaved),
    note: normalizeText(input.note),
  };
  const { data: updated, error: updateError } = await client
    .from('memories')
    .update(personalFields)
    .eq('user_id', input.userId)
    .eq('repo_id', input.repoId)
    .select(MEMORY_COLUMNS)
    .maybeSingle();

  if (updateError) {
    throw updateError;
  }
  if (updated) {
    return mapMemoryRow(updated);
  }

  const { data: inserted, error: insertError } = await client
    .from('memories')
    .insert({
      user_id: input.userId,
      repo_id: input.repoId,
      source: 'github_star',
      ...personalFields,
    })
    .select(MEMORY_COLUMNS)
    .single();

  if (insertError) {
    throw insertError;
  }

  return mapMemoryRow(inserted);
}
