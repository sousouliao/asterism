export interface AuthenticatedPrincipal {
  userId: string;
  jwt: string;
  scopes: string[];
  expiresAt?: number;
}

export interface JwtClaimsVerifier {
  getUser: (jwt: string) => Promise<{ data: { user: { id: string } | null }; error: unknown }>;
}

export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get('Authorization');
  if (!header) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();
  return token ? token : null;
}

function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  const parts = jwt.split('.');
  if (parts.length !== 3 || !parts[1]) {
    return null;
  }
  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    const decoded = atob(padded);
    const parsed = JSON.parse(decoded);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * 通过 Supabase Auth 服务端校验用户 JWT（保证 Settings 撤销 OAuth 授权后立即失效）。
 * 仅用于鉴权身份确认；具体数据读取仍交由调用方 JWT 对应的 RLS 作用域客户端执行。
 */
export async function verifyBearerPrincipal(
  verifier: JwtClaimsVerifier,
  jwt: string,
): Promise<AuthenticatedPrincipal | null> {
  if (!jwt) {
    return null;
  }
  try {
    const { data, error } = await verifier.getUser(jwt);
    if (error || !data.user?.id) {
      return null;
    }
    const payload = decodeJwtPayload(jwt);
    const rawScope = typeof payload?.scope === 'string' ? payload.scope : '';
    const scopes = rawScope
      .split(' ')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    const expiresAt = typeof payload?.exp === 'number' ? payload.exp : undefined;

    return {
      userId: data.user.id,
      jwt,
      scopes,
      ...(expiresAt !== undefined ? { expiresAt } : {}),
    };
  } catch {
    return null;
  }
}

export function parseCsvOrigins(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
