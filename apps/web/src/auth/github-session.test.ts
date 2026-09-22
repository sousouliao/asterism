import type { Session } from '@asterism/db';
import { describe, expect, it } from 'vitest';
import { getGitHubSessionStatus } from './github-session';

describe('getGitHubSessionStatus', () => {
  it('requires reconnect when a signed-in Supabase session has no GitHub provider token', () => {
    const session = { user: { id: 'user-1' } } as Session;

    expect(getGitHubSessionStatus(session)).toEqual({
      hasSession: true,
      hasProviderToken: false,
      requiresReconnect: true,
    });
  });

  it('does not require reconnect when the provider token is present', () => {
    const session = { provider_token: 'github-token', user: { id: 'user-1' } } as Session;

    expect(getGitHubSessionStatus(session).requiresReconnect).toBe(false);
  });

  it('uses a stored connection after the browser provider token disappears', () => {
    const session = { user: { id: 'user-1' } } as Session;
    expect(getGitHubSessionStatus(session, true).requiresReconnect).toBe(false);
  });

  it('requires reconnect when GitHub revoked the saved credential', () => {
    const session = { provider_token: 'stale', user: { id: 'user-1' } } as Session;
    expect(getGitHubSessionStatus(session, false, true).requiresReconnect).toBe(true);
  });

  it('does not require reconnect before the user signs in', () => {
    expect(getGitHubSessionStatus(null)).toEqual({
      hasSession: false,
      hasProviderToken: false,
      requiresReconnect: false,
    });
  });
});
