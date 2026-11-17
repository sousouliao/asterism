import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { buildLoginPath, sanitizeNextPath } from './redirect';
import { useSession } from './use-session';

function FullScreenLoader() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-svh items-center justify-center bg-background">
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-3 text-muted-foreground text-sm"
      >
        <span
          className="size-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent motion-reduce:animate-none"
          aria-hidden="true"
        />
        {t('auth.loading')}
      </div>
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useSession();
  const location = useLocation();

  if (loading) {
    return <FullScreenLoader />;
  }
  if (!session) {
    return <Navigate to={buildLoginPath(location.pathname, location.search)} replace />;
  }
  return children;
}

export function RequireAnon({ children }: { children: ReactNode }) {
  const { session, loading } = useSession();
  const [searchParams] = useSearchParams();

  if (loading) {
    return <FullScreenLoader />;
  }
  if (session) {
    return <Navigate to={sanitizeNextPath(searchParams.get('next')) ?? '/'} replace />;
  }
  return children;
}
