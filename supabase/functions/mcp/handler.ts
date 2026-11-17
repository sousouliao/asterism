import { StreamableHttpTransport } from 'mcp-lite';
import { type AuthenticatedPrincipal, extractBearerToken } from '../_shared/auth.ts';
import { createJsonResponder, resolveCorsHeaders } from '../_shared/cors.ts';
import { createAsterismMcpServer, type McpToolsDependencies } from './tools.ts';

export interface McpHandlerDependencies extends McpToolsDependencies {
  resourceUrl: string;
  authorizationServerUrl: string;
  authenticate: (jwt: string) => Promise<AuthenticatedPrincipal | null>;
  allowedOrigins?: readonly string[];
}

const MCP_ALLOW_HEADERS =
  'authorization, x-client-info, apikey, content-type, accept, mcp-protocol-version, mcp-session-id';
const MCP_EXPOSE_HEADERS = 'WWW-Authenticate, Mcp-Session-Id';
const MCP_METHODS = 'GET, POST, DELETE, OPTIONS';

function normalizeUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

function isProtectedResourceMetadataPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, '');
  return (
    normalized.endsWith('/.well-known/oauth-protected-resource') ||
    normalized.endsWith('/oauth-protected-resource')
  );
}

function mergeCorsHeaders(response: Response, corsHeaders: Record<string, string>): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    if (key === 'Vary' && headers.has('Vary')) {
      const current = headers.get('Vary') ?? '';
      if (!current.split(',').some((item) => item.trim().toLowerCase() === 'origin')) {
        headers.set('Vary', `${current}, ${value}`);
      }
    } else {
      headers.set(key, value);
    }
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function createMcpHttpHandler(dependencies: McpHandlerDependencies) {
  const resourceUrl = normalizeUrl(dependencies.resourceUrl);
  const authorizationServerUrl = normalizeUrl(dependencies.authorizationServerUrl);
  const metadataUrl = `${resourceUrl}/.well-known/oauth-protected-resource`;

  const server = createAsterismMcpServer({
    createUserStore: dependencies.createUserStore,
    resolveGitHubToken: dependencies.resolveGitHubToken,
    fetchGitHub: dependencies.fetchGitHub,
  });
  const transport = new StreamableHttpTransport();
  const handleMcpRequest = transport.bind(server);

  return async (request: Request): Promise<Response> => {
    const corsHeaders = resolveCorsHeaders(request, {
      allowedOrigins: dependencies.allowedOrigins,
      methods: MCP_METHODS,
      allowHeaders: MCP_ALLOW_HEADERS,
      exposeHeaders: MCP_EXPOSE_HEADERS,
    });
    const json = createJsonResponder(corsHeaders);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    if (request.method === 'GET' && isProtectedResourceMetadataPath(url.pathname)) {
      return json({
        resource: resourceUrl,
        authorization_servers: [authorizationServerUrl],
        bearer_methods_supported: ['header'],
        scopes_supported: ['openid', 'profile', 'email'],
      });
    }

    const jwt = extractBearerToken(request);
    if (!jwt) {
      return json(
        { error: 'unauthorized', error_description: 'Bearer access token required' },
        401,
        { 'WWW-Authenticate': `Bearer resource_metadata="${metadataUrl}"` },
      );
    }

    const principal = await dependencies.authenticate(jwt);
    if (!principal) {
      return json(
        { error: 'invalid_token', error_description: 'Invalid or expired OAuth access token' },
        401,
        {
          'WWW-Authenticate': `Bearer resource_metadata="${metadataUrl}", error="invalid_token"`,
        },
      );
    }

    const response = await handleMcpRequest(request, {
      authInfo: {
        token: principal.jwt,
        scopes: principal.scopes,
        ...(principal.expiresAt !== undefined ? { expiresAt: principal.expiresAt } : {}),
        extra: { userId: principal.userId },
      },
    });
    return mergeCorsHeaders(response, corsHeaders);
  };
}
