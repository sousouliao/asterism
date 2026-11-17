import { extractBearerToken } from '../_shared/auth.ts';
import { createJsonResponder, resolveCorsHeaders } from '../_shared/cors.ts';

type ReadmeTransportOutcome =
  | { status: 'success'; html: string; etag: string | null }
  | { status: 'not_modified'; etag: string | null }
  | { status: 'not_found' }
  | { status: 'not_in_library' }
  | { status: 'rate_limited' }
  | { status: 'reconnect_required' }
  | { status: 'retryable_error' };

export type MembershipResult = 'member' | 'not_member' | 'error';

export interface ReadRepoReadmeDependencies {
  authenticate: (jwt: string) => Promise<string | null>;
  checkMembership: (userId: string, fullName: string) => Promise<MembershipResult>;
  fetchGitHub: typeof fetch;
  resolveStoredToken?: (userId: string) => Promise<string | undefined>;
}

const defaultCorsHeaders = resolveCorsHeaders(new Request('https://localhost/read-repo-readme'));
const json = createJsonResponder<ReadmeTransportOutcome | { error: string }>(defaultCorsHeaders);

function isRepoSegment(value: unknown): value is string {
  return (
    typeof value === 'string' && value.length > 0 && value.length <= 100 && /^[\w.-]+$/.test(value)
  );
}

function optionalHeaderValue(value: unknown, maxLength: number): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength
    ? value
    : undefined;
}

export function createReadRepoReadmeHandler(dependencies: ReadRepoReadmeDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') {
      return new Response('ok', { headers: defaultCorsHeaders });
    }
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    const jwt = extractBearerToken(request);
    if (!jwt) {
      return json({ error: 'Missing Authorization bearer token' }, 401);
    }

    let userId: string | null;
    try {
      userId = await dependencies.authenticate(jwt);
    } catch {
      userId = null;
    }
    if (!userId) {
      return json({ error: 'Invalid or expired session' }, 401);
    }

    let body: { owner?: unknown; name?: unknown; providerToken?: unknown; etag?: unknown };
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }
    if (!isRepoSegment(body.owner) || !isRepoSegment(body.name)) {
      return json({ error: 'Invalid repository route' }, 400);
    }

    let membership: MembershipResult;
    try {
      membership = await dependencies.checkMembership(userId, `${body.owner}/${body.name}`);
    } catch {
      membership = 'error';
    }
    if (membership === 'error') {
      return json({ status: 'retryable_error' }, 500);
    }
    if (membership === 'not_member') {
      return json({ status: 'not_in_library' });
    }

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.html+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'asterism-read-repo-readme',
    };
    const providerToken =
      optionalHeaderValue(body.providerToken, 4096) ??
      (dependencies.resolveStoredToken ? await dependencies.resolveStoredToken(userId) : undefined);
    const etag = optionalHeaderValue(body.etag, 512);
    if (providerToken) {
      headers.Authorization = `Bearer ${providerToken}`;
    }
    if (etag) {
      headers['If-None-Match'] = etag;
    }

    let response: Response;
    try {
      response = await dependencies.fetchGitHub(
        `https://api.github.com/repos/${encodeURIComponent(body.owner)}/${encodeURIComponent(body.name)}/readme`,
        { headers },
      );
    } catch {
      return json({ status: 'retryable_error' }, 502);
    }

    if (response.status === 304) {
      return json({ status: 'not_modified', etag: response.headers.get('etag') ?? etag ?? null });
    }
    if (response.ok) {
      try {
        const html = await response.text();
        return json({ status: 'success', html, etag: response.headers.get('etag') });
      } catch {
        return json({ status: 'retryable_error' }, 502);
      }
    }
    if (response.status === 404) {
      return json({ status: 'not_found' });
    }
    if (response.status === 401) {
      return json({ status: 'reconnect_required' });
    }
    if (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') {
      return json({ status: 'rate_limited' });
    }
    return json({ status: 'retryable_error' }, 502);
  };
}
