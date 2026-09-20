export interface MemorySyncStore {
  /**
   * 调用 `public.ensure_user_memories`：一条语句补齐缺失的基础 Memory，并只为
   * source_created_at 为空的既有记录回填收藏时间。
   */
  repairMemories: (
    userId: string,
  ) => Promise<{ data: number | null; error: { message: string } | null }>;
}

/**
 * Repairs all missing base Memories for a user, and backfills the star time on
 * rows that were created before sync ever saw them.
 *
 * 修复逻辑整体下推到 SQL：分页 upsert 曾用 ignoreDuplicates 保护用户已写入的
 * why_saved / note，代价是用户先手工保存过的记录会被整行跳过，其 source_created_at
 * 永远为 null，Resurface 的沉睡判定因此永远跳过这些仓库。数据库端的条件冲突更新
 * 同时满足两个要求：不覆盖用户内容，且补齐缺失的收藏时间。
 */
export async function ensureUserMemories(store: MemorySyncStore, userId: string): Promise<number> {
  const { data, error } = await store.repairMemories(userId);
  if (error) {
    throw new Error(`Failed to repair Memories: ${error.message}`);
  }
  return data ?? 0;
}
