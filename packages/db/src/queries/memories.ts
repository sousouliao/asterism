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

/** 按 PAGE_SIZE 翻页直到取回不足一页为止，把 range 计算收在一处。 */
async function collectPages<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const page = await fetchPage(from, from + PAGE_SIZE - 1);
    all.push(...page);
    if (page.length < PAGE_SIZE) {
      return all;
    }
  }
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

/**
 * 读取当前用户的全部 Memory，供导出、Browse 检索上下文与 Note 标记共用。
 *
 * 这里刻意只保留这一个列表查询：曾经并存的「仅取有 Note 的 repo_id」查询是同一份
 * 数据的第二次往返，两个查询各自的加载态很容易漏纳入界面判断，从而在首屏出现
 * 记忆尚未到达却已按「无匹配」渲染的窗口。派生远比再查一次安全。
 */
export async function listMemories(client: SupabaseClient, userId: string): Promise<Memory[]> {
  return collectPages(async (from, to) => {
    const { data, error } = await client
      .from('memories')
      .select(MEMORY_COLUMNS)
      .eq('user_id', userId)
      .order('repo_id', { ascending: true })
      .range(from, to);

    if (error) {
      throw error;
    }
    return (data ?? []).map((row) => mapMemoryRow(row));
  });
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

/**
 * 保存个人上下文；清空字段写为 null，基础 Memory 始终保留。
 *
 * 用单条 upsert 而非「先 update 再 insert」：后者在 update 未命中与 insert 之间
 * 留有窗口，同一用户并发保存（多标签页，或 sync 正好补齐基础 Memory）会让 insert
 * 撞上唯一约束而整次保存失败。载荷不含 source_created_at，冲突更新不会覆盖
 * sync 写入的收藏时间。
 */
export async function saveMemory(
  client: SupabaseClient,
  input: { userId: string; repoId: string; whySaved: string; note: string },
): Promise<Memory> {
  const { data, error } = await client
    .from('memories')
    .upsert(
      {
        user_id: input.userId,
        repo_id: input.repoId,
        source: 'github_star',
        why_saved: normalizeText(input.whySaved),
        note: normalizeText(input.note),
      },
      { onConflict: 'user_id,repo_id' },
    )
    .select(MEMORY_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  return mapMemoryRow(data);
}
