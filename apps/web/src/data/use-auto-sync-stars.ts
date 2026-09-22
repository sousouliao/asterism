import { getGitHubSyncStatus, invokeSyncStars } from '@asterism/db';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useSession } from '../auth/use-session';
import { supabase } from '../lib/supabase';
import { memoryKeys, repoKeys } from './keys';

const FRESH_FOR_MS = 6 * 60 * 60 * 1000;
const STATUS_POLL_MS = 5 * 60 * 1000;

/** 开站时静默补一次过期同步；定时服务端同步仍是关站后的主路径。 */
export function useAutoSyncStars() {
  const { session } = useSession();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const attempted = useRef<string | null>(null);
  const observedSync = useRef<{ userId: string; lastSyncedAt: string | null } | null>(null);
  const status = useQuery({
    queryKey: ['github-sync-status', userId],
    enabled: Boolean(userId),
    queryFn: () => getGitHubSyncStatus(supabase),
    refetchInterval: STATUS_POLL_MS,
  });

  useEffect(() => {
    if (!userId || !status.data) return;
    const previous = observedSync.current;
    observedSync.current = { userId, lastSyncedAt: status.data.lastSyncedAt };
    if (previous?.userId !== userId || previous.lastSyncedAt === status.data.lastSyncedAt) return;
    void queryClient.invalidateQueries({ queryKey: repoKeys.starred(userId) });
    void queryClient.invalidateQueries({ queryKey: repoKeys.library(userId) });
    void queryClient.invalidateQueries({ queryKey: memoryKeys.all });
  }, [userId, status.data, queryClient]);

  useEffect(() => {
    if (!userId || !status.data) return;
    const token = session?.provider_token;
    if (!status.data.connected && !token) return;
    const last = status.data.lastSyncedAt ? Date.parse(status.data.lastSyncedAt) : 0;
    if (Date.now() - last < FRESH_FOR_MS) return;
    const attemptKey = `${userId}:${token ?? 'stored'}`;
    if (attempted.current === attemptKey) return;
    attempted.current = attemptKey;

    void invokeSyncStars(
      supabase,
      token ?? undefined,
      session?.provider_refresh_token ?? undefined,
    ).then(
      () => {
        void queryClient.invalidateQueries({ queryKey: repoKeys.starred(userId) });
        void queryClient.invalidateQueries({ queryKey: repoKeys.library(userId) });
        void queryClient.invalidateQueries({ queryKey: memoryKeys.all });
        void queryClient.invalidateQueries({ queryKey: ['github-sync-status', userId] });
      },
      () => {
        void queryClient.invalidateQueries({ queryKey: ['github-sync-status', userId] });
      },
    );
  }, [userId, session?.provider_token, session?.provider_refresh_token, status.data, queryClient]);
}
