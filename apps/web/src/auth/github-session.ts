import type { Session } from '@asterism/db';

export interface GitHubSessionStatus {
  hasSession: boolean;
  hasProviderToken: boolean;
  requiresReconnect: boolean;
}

export function getGitHubSessionStatus(
  session: Session | null,
  storedConnection = false,
  connectionInvalid = false,
): GitHubSessionStatus {
  const hasSession = Boolean(session);
  const hasProviderToken = Boolean(session?.provider_token);

  return {
    hasSession,
    hasProviderToken,
    requiresReconnect:
      hasSession && (connectionInvalid || (!hasProviderToken && !storedConnection)),
  };
}
