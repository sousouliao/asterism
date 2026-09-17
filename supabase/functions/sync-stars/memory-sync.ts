const MEMORY_PAGE_SIZE = 500;

type UserStarRow = { repo_id: string; starred_at: string | null };

export interface MemorySyncStore {
  listUserStars: (
    userId: string,
    from: number,
    to: number,
  ) => Promise<{ data: UserStarRow[] | null; error: { message: string } | null }>;
  insertMissingMemories: (
    rows: Array<{
      user_id: string;
      repo_id: string;
      source: 'github_star';
      source_created_at: string | null;
    }>,
  ) => Promise<{ error: { message: string } | null }>;
}

/**
 * Repairs all missing base Memories for a user. The insert is conflict-ignoring so an
 * existing why_saved or note can never be overwritten, including on sync retries.
 */
export async function ensureUserMemories(store: MemorySyncStore, userId: string): Promise<number> {
  let from = 0;
  let ensured = 0;

  for (;;) {
    const { data, error } = await store.listUserStars(userId, from, from + MEMORY_PAGE_SIZE - 1);
    if (error) {
      throw new Error(`Failed to read user stars for Memory repair: ${error.message}`);
    }

    const rows = data ?? [];
    if (rows.length === 0) {
      return ensured;
    }

    const { error: insertError } = await store.insertMissingMemories(
      rows.map((row) => ({
        user_id: userId,
        repo_id: row.repo_id,
        source: 'github_star',
        source_created_at: row.starred_at,
      })),
    );
    if (insertError) {
      throw new Error(`Failed to create base Memories: ${insertError.message}`);
    }

    ensured += rows.length;
    if (rows.length < MEMORY_PAGE_SIZE) {
      return ensured;
    }
    from += MEMORY_PAGE_SIZE;
  }
}
