import { getGitHubSyncStatus, signInWithGitHub } from '@asterism/db';
import { toast } from '@asterism/ui';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { getGitHubSessionStatus } from './github-session';
import { useSession } from './use-session';

function waitForNextPaint(): Promise<void> {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}

export function useGitHubReconnect() {
  const { t } = useTranslation();
  const { session, loading } = useSession();
  const connection = useQuery({
    queryKey: ['github-sync-status', session?.user.id],
    enabled: Boolean(session?.user.id),
    queryFn: () => getGitHubSyncStatus(supabase),
  });
  const [reconnectPending, setReconnectPending] = useState(false);
  const status = getGitHubSessionStatus(
    session,
    connection.isLoading || connection.data?.connected,
    connection.data?.lastError === 'reconnect_required',
  );

  const reconnect = useCallback(async () => {
    if (reconnectPending) {
      return;
    }

    setReconnectPending(true);
    const redirectTo = window.location.origin;

    await waitForNextPaint();

    const { error } = await signInWithGitHub(supabase, redirectTo);

    if (error) {
      setReconnectPending(false);
      toast.error(t('sync.reconnectError'), { description: error.message });
    }
  }, [reconnectPending, t]);

  return {
    session,
    loading: loading || connection.isLoading,
    reconnectPending,
    ...status,
    reconnect,
  };
}
