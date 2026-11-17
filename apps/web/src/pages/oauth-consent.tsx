import {
  approveOAuthAuthorization,
  denyOAuthAuthorization,
  getOAuthAuthorizationDetails,
  type OAuthAuthorizationDetails,
} from '@asterism/db';
import { Avatar, AvatarFallback, AvatarImage, Badge, Button, Separator } from '@asterism/ui';
import { LoaderCircleIcon, ShieldCheckIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { useSession } from '../auth/use-session';
import { BrandLogo } from '../components/brand-logo';
import { PendingActionContent } from '../components/pending-action-content';
import { ThemeToggle } from '../components/theme-toggle';
import { supabase } from '../lib/supabase';

function safeHttpUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
      ? parsed.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function formatRedirectOrigin(redirectUri: string): string {
  try {
    return new URL(redirectUri).origin;
  } catch {
    return redirectUri;
  }
}

function defaultRedirect(url: string) {
  window.location.replace(url);
}

export function OAuthConsentPage({
  onRedirect = defaultRedirect,
}: {
  onRedirect?: (url: string) => void;
}) {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { session } = useSession();
  const authorizationId = searchParams.get('authorization_id')?.trim() ?? '';

  const [loading, setLoading] = useState(Boolean(authorizationId));
  const [details, setDetails] = useState<OAuthAuthorizationDetails | null>(null);
  const [loadError, setLoadError] = useState<string | null>(
    authorizationId ? null : t('oauthConsent.missingRequest'),
  );
  const [decision, setDecision] = useState<'approve' | 'deny' | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);

  useEffect(() => {
    if (!authorizationId) {
      setLoading(false);
      setLoadError(t('oauthConsent.missingRequest'));
      return;
    }

    let active = true;
    setLoading(true);
    setLoadError(null);

    getOAuthAuthorizationDetails(supabase, authorizationId)
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data) {
          setLoadError(t('oauthConsent.loadError'));
          setLoading(false);
          return;
        }
        if ('redirect_url' in data) {
          onRedirect(data.redirect_url);
          return;
        }
        setDetails(data);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setLoadError(t('oauthConsent.loadError'));
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [authorizationId, onRedirect, t]);

  async function handleDecision(action: 'approve' | 'deny') {
    if (!authorizationId || decision !== null) return;
    setDecision(action);
    setDecisionError(null);
    try {
      const { data, error } =
        action === 'approve'
          ? await approveOAuthAuthorization(supabase, authorizationId)
          : await denyOAuthAuthorization(supabase, authorizationId);
      if (error || !data?.redirect_url) {
        setDecisionError(t('oauthConsent.decisionError'));
        setDecision(null);
        return;
      }
      onRedirect(data.redirect_url);
    } catch {
      setDecisionError(t('oauthConsent.decisionError'));
      setDecision(null);
    }
  }

  const accountName =
    (session?.user.user_metadata?.user_name as string | undefined) ??
    (session?.user.user_metadata?.name as string | undefined) ??
    session?.user.email ??
    '';
  const clientName = details?.client.name || 'MCP Client';
  const logoUrl = safeHttpUrl(details?.client.logo_uri);
  const scopes = (details?.scope ?? '')
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <main className="relative flex min-h-svh items-center justify-center bg-background px-6 py-12">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <section className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BrandLogo className="size-6" title={t('app.name')} />
            <span className="font-semibold text-foreground text-base">{t('app.name')}</span>
          </div>
          {accountName ? (
            <span className="truncate text-caption text-muted-foreground">
              {t('oauthConsent.signedInAccount', { name: accountName })}
            </span>
          ) : null}
        </div>

        {loading ? (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-3 py-8 text-body text-muted-foreground"
          >
            <LoaderCircleIcon
              className="size-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
            {t('oauthConsent.loading')}
          </div>
        ) : loadError || !details ? (
          <div className="flex flex-col gap-4">
            <p role="alert" className="text-body text-destructive">
              {loadError ?? t('oauthConsent.loadError')}
            </p>
            <Button asChild variant="outline">
              <Link to="/">{t('oauthConsent.backHome')}</Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex items-start gap-3">
              <Avatar className="size-10 shrink-0">
                {logoUrl ? <AvatarImage src={logoUrl} alt={clientName} /> : null}
                <AvatarFallback>{clientName.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col gap-1">
                <h1 className="font-semibold text-section-title text-card-foreground leading-tight">
                  {t('oauthConsent.title')}
                </h1>
                <p className="text-body text-muted-foreground">
                  {t('oauthConsent.subtitle', { name: clientName })}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-lg bg-muted p-4 text-body">
              <div className="flex items-start gap-2 text-card-foreground">
                <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-link" aria-hidden="true" />
                <p className="text-caption leading-relaxed">{t('oauthConsent.readOnlyNotice')}</p>
              </div>

              <Separator />

              <div className="flex flex-col gap-1.5">
                <span className="text-caption text-muted-foreground">
                  {t('oauthConsent.redirectLabel')}
                </span>
                <code className="truncate rounded bg-background px-2 py-1 font-mono text-caption text-foreground">
                  {formatRedirectOrigin(details.redirect_uri)}
                </code>
              </div>

              {scopes.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-caption text-muted-foreground">
                    {t('oauthConsent.scopesLabel')}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {scopes.map((scope) => (
                      <Badge key={scope} variant="secondary">
                        {scope}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {decisionError ? (
              <p role="alert" className="text-caption text-destructive">
                {decisionError}
              </p>
            ) : null}

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="flex-1"
                disabled={decision !== null}
                aria-busy={decision === 'deny'}
                onClick={() => void handleDecision('deny')}
              >
                <PendingActionContent
                  pending={decision === 'deny'}
                  idleLabel={t('oauthConsent.deny')}
                  pendingLabel={t('oauthConsent.denying')}
                />
              </Button>
              <Button
                className="flex-1"
                disabled={decision !== null}
                aria-busy={decision === 'approve'}
                onClick={() => void handleDecision('approve')}
              >
                <PendingActionContent
                  pending={decision === 'approve'}
                  idleLabel={t('oauthConsent.approve')}
                  pendingLabel={t('oauthConsent.approving')}
                />
              </Button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
