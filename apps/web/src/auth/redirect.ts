const DUMMY_ORIGIN = 'https://asterism.local';

/**
 * 仅允许站内相对路径回跳（以单斜杠开头且非登录页），阻止开放重定向或回跳死循环。
 */
export function sanitizeNextPath(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return null;
  }
  try {
    const parsed = new URL(trimmed, DUMMY_ORIGIN);
    if (parsed.origin !== DUMMY_ORIGIN || parsed.pathname === '/login') {
      return null;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function buildLoginPath(pathname: string, search = ''): string {
  const safeNext = sanitizeNextPath(`${pathname}${search}`);
  if (!safeNext || safeNext === '/') {
    return '/login';
  }
  return `/login?next=${encodeURIComponent(safeNext)}`;
}

export function buildOAuthRedirectUrl(
  origin: string,
  nextParam: string | null | undefined,
): string {
  const normalizedOrigin = origin.replace(/\/+$/, '');
  const safeNext = sanitizeNextPath(nextParam);
  return safeNext ? `${normalizedOrigin}${safeNext}` : normalizedOrigin;
}
