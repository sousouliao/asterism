import type { SupabaseClient } from './client';

export interface GitHubSyncStatus {
  connected: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
}

export async function getGitHubSyncStatus(client: SupabaseClient): Promise<GitHubSyncStatus> {
  const { data, error } = await client.rpc('github_sync_status');
  if (error) throw error;
  const row = data?.[0];
  return {
    connected: row?.connected ?? false,
    lastSyncedAt: row?.last_synced_at ?? null,
    lastError: row?.last_error ?? null,
  };
}
