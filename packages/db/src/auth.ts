import type {
  AuthOAuthAuthorizationDetailsResponse,
  AuthOAuthConsentResponse,
  AuthOAuthGrantsResponse,
  AuthOAuthRevokeGrantResponse,
  OAuthAuthorizationDetails,
  OAuthGrant,
  OAuthRedirect,
  OAuthResponse,
  Session,
  SupabaseClient,
} from '@supabase/supabase-js';

/**
 * 通过 GitHub OAuth 登录。MVP 为只读浏览，仅申请最小 scope（公开 star 列表无需额外
 * scope）；批量写操作所需的 `public_repo` 留到进阶能力时再按需申请。
 */
export function signInWithGitHub(
  client: SupabaseClient,
  redirectTo?: string,
): Promise<OAuthResponse> {
  return client.auth.signInWithOAuth({
    provider: 'github',
    options: redirectTo ? { redirectTo } : undefined,
  });
}

export function signOut(client: SupabaseClient): Promise<{ error: Error | null }> {
  return client.auth.signOut();
}

export async function getSession(client: SupabaseClient): Promise<Session | null> {
  const { data } = await client.auth.getSession();
  return data.session;
}

/**
 * 订阅会话变化，返回取消订阅函数。用于在客户端保持登录态与 UI 同步。
 */
export function onAuthChange(
  client: SupabaseClient,
  callback: (session: Session | null) => void,
): () => void {
  const { data } = client.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => {
    data.subscription.unsubscribe();
  };
}

export function getOAuthAuthorizationDetails(
  client: SupabaseClient,
  authorizationId: string,
): Promise<AuthOAuthAuthorizationDetailsResponse> {
  return client.auth.oauth.getAuthorizationDetails(authorizationId);
}

export function approveOAuthAuthorization(
  client: SupabaseClient,
  authorizationId: string,
): Promise<AuthOAuthConsentResponse> {
  return client.auth.oauth.approveAuthorization(authorizationId, {
    skipBrowserRedirect: true,
  });
}

export function denyOAuthAuthorization(
  client: SupabaseClient,
  authorizationId: string,
): Promise<AuthOAuthConsentResponse> {
  return client.auth.oauth.denyAuthorization(authorizationId, {
    skipBrowserRedirect: true,
  });
}

export function listOAuthGrants(client: SupabaseClient): Promise<AuthOAuthGrantsResponse> {
  return client.auth.oauth.listGrants();
}

export function revokeOAuthGrant(
  client: SupabaseClient,
  clientId: string,
): Promise<AuthOAuthRevokeGrantResponse> {
  return client.auth.oauth.revokeGrant({ clientId });
}

export type { OAuthAuthorizationDetails, OAuthGrant, OAuthRedirect, Session };
