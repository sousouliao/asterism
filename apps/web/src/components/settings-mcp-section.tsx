import { listOAuthGrants, type OAuthGrant, revokeOAuthGrant } from '@asterism/db';
import { Badge, Button, Separator, Skeleton } from '@asterism/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '../auth/use-session';
import { mcpGrantKeys } from '../data/keys';
import { formatRelativeTime } from '../lib/format';
import { supabase } from '../lib/supabase';
import { ConfirmDialog } from './confirm-dialog';
import { SectionHeader } from './section-header';

const DESTRUCTIVE_OUTLINE_CLASS =
  'border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive';

function resolveMcpEndpointUrl(override?: string): string {
  if (override) return override;
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  if (!supabaseUrl) {
    return 'https://<project-ref>.supabase.co/functions/v1/mcp';
  }
  return `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/mcp`;
}

export function SettingsMcpSection({ endpointUrl }: { endpointUrl?: string }) {
  const { t, i18n } = useTranslation();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const userId = session?.user.id ?? 'anonymous';
  const resolvedEndpoint = resolveMcpEndpointUrl(endpointUrl);

  const [copied, setCopied] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<OAuthGrant | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const grantsQuery = useQuery({
    queryKey: mcpGrantKeys.list(userId),
    enabled: Boolean(session?.user.id),
    queryFn: async () => {
      const { data, error } = await listOAuthGrants(supabase);
      if (error) {
        throw error;
      }
      return data ?? [];
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await revokeOAuthGrant(supabase, clientId);
      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      setRevokeTarget(null);
      setRevokeError(null);
      await queryClient.invalidateQueries({ queryKey: mcpGrantKeys.list(userId) });
    },
    onError: () => {
      setRevokeError(t('settings.mcp.revokeError'));
    },
  });

  async function handleCopyEndpoint() {
    try {
      await navigator.clipboard.writeText(resolvedEndpoint);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const grants = grantsQuery.data ?? [];

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        title={t('settings.mcp.title')}
        badge={<Badge variant="secondary">{t('settings.mcp.readOnlyBadge')}</Badge>}
        description={t('settings.mcp.description')}
      />

      <div className="rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="font-medium text-foreground text-sm">{t('settings.mcp.endpointLabel')}</p>
            <p className="text-muted-foreground text-xs">{t('settings.mcp.endpointHint')}</p>
            <code className="mt-1 truncate rounded bg-muted px-2.5 py-1.5 font-mono text-caption text-foreground">
              {resolvedEndpoint}
            </code>
          </div>
          <Button variant="outline" size="sm" onClick={() => void handleCopyEndpoint()}>
            {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
            {copied ? t('settings.mcp.copiedEndpoint') : t('settings.mcp.copyEndpoint')}
          </Button>
        </div>

        <Separator />

        <div className="flex flex-col gap-3 p-4">
          <p className="font-medium text-foreground text-sm">{t('settings.mcp.clientsLabel')}</p>

          {grantsQuery.isLoading ? (
            <div className="flex flex-col gap-2" aria-busy="true">
              <Skeleton className="h-12 w-full rounded-md" />
            </div>
          ) : grantsQuery.isError ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
              <p role="alert" className="text-caption text-destructive">
                {t('settings.mcp.clientsLoadError')}
              </p>
              <Button variant="outline" size="sm" onClick={() => void grantsQuery.refetch()}>
                {t('common.retry')}
              </Button>
            </div>
          ) : grants.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('settings.mcp.clientsEmpty')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {grants.map((grant) => {
                const grantedLabel = formatRelativeTime(
                  grant.granted_at,
                  i18n.resolvedLanguage ?? 'en',
                );
                return (
                  <li
                    key={grant.client.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5"
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground text-sm">
                          {grant.client.name}
                        </span>
                        {grant.scopes.map((scope) => (
                          <Badge key={scope} variant="secondary">
                            {scope}
                          </Badge>
                        ))}
                      </div>
                      {grantedLabel ? (
                        <span className="text-muted-foreground text-xs">
                          {t('settings.mcp.grantedAt', { date: grantedLabel })}
                        </span>
                      ) : null}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className={DESTRUCTIVE_OUTLINE_CLASS}
                      onClick={() => {
                        setRevokeError(null);
                        setRevokeTarget(grant);
                      }}
                    >
                      {t('settings.mcp.revoke')}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setRevokeTarget(null);
            setRevokeError(null);
          }
        }}
        title={t('settings.mcp.revokeTitle', { name: revokeTarget?.client.name ?? '' })}
        description={t('settings.mcp.revokeDescription')}
        confirmLabel={t('settings.mcp.revokeConfirm')}
        pendingLabel={t('settings.mcp.revoking')}
        pending={revokeMutation.isPending}
        errorMessage={revokeError ?? undefined}
        onConfirm={() => {
          if (revokeTarget) {
            revokeMutation.mutate(revokeTarget.client.id);
          }
        }}
      />
    </section>
  );
}
