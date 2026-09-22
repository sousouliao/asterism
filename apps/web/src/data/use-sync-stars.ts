import { invokeSyncStars } from '@asterism/db';
import { toast } from '@asterism/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useGitHubReconnect } from '../auth/use-github-reconnect';
import { useSession } from '../auth/use-session';
import { supabase } from '../lib/supabase';
import { repoKeys } from './keys';

/** 触发 stars 同步（Edge Function），并在完成后刷新仓库列表 + sonner 进度反馈。 */
export function useSyncStars() {
  const { t } = useTranslation();
  const { session } = useSession();
  const { reconnect, reconnectPending, requiresReconnect } = useGitHubReconnect();
  const queryClient = useQueryClient();
  const userId = session?.user.id;

  const mutation = useMutation({
    mutationFn: () =>
      invokeSyncStars(
        supabase,
        session?.provider_token ?? undefined,
        session?.provider_refresh_token ?? undefined,
      ),
    onSuccess: (result) => {
      toast.success(t('sync.success', { count: result.total, historyCount: result.unstarred }));
      if (userId) {
        void queryClient.invalidateQueries({ queryKey: repoKeys.starred(userId) });
        void queryClient.invalidateQueries({ queryKey: repoKeys.library(userId) });
        void queryClient.invalidateQueries({ queryKey: ['github-sync-status', userId] });
      }
    },
    onError: (error) => {
      if (userId) {
        void queryClient.invalidateQueries({ queryKey: ['github-sync-status', userId] });
      }
      const detail = error instanceof Error ? error.message : undefined;
      toast.error(t('sync.error'), detail ? { description: detail } : undefined);
    },
  });

  return {
    ...mutation,
    requiresReconnect,
    reconnect,
    reconnectPending,
    sync: () => {
      if (requiresReconnect) {
        void reconnect();
        return;
      }
      mutation.mutate();
    },
  };
}
