import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedPrincipal } from '../_shared/auth';
import { createMcpHttpHandler, type McpHandlerDependencies } from './handler';
import type { McpUserStore } from './tools';

function createMockStore(overrides: Partial<McpUserStore> = {}): McpUserStore {
  return {
    getLibrarySummary: vi.fn().mockResolvedValue({
      activeStars: 12,
      historicalStars: 2,
      annotatedMemories: 5,
      collectionsCount: 3,
      topLanguages: [{ language: 'Rust', count: 6 }],
      topTopics: [{ topic: 'mcp', count: 4 }],
      collections: [],
    }),
    searchRepos: vi.fn().mockResolvedValue({
      total: 1,
      hasMore: false,
      items: [{ repoId: 'repo-1', fullName: 'acme/mcp-kit', whySaved: 'MCP server kit' }],
    }),
    getRepo: vi.fn().mockResolvedValue({
      repoId: 'repo-1',
      fullName: 'acme/mcp-kit',
      whySaved: 'MCP server kit',
      note: 'Great schema adapter',
    }),
    listCollections: vi.fn().mockResolvedValue([{ id: 'col-1', name: 'MCP', repoCount: 1 }]),
    getCollection: vi.fn().mockResolvedValue({
      id: 'col-1',
      name: 'MCP',
      total: 1,
      hasMore: false,
      items: [{ repoId: 'repo-1', fullName: 'acme/mcp-kit' }],
    }),
    getRelatedRepos: vi.fn().mockResolvedValue({
      anchorRepoId: 'repo-1',
      mode: 'semantic',
      items: [{ repoId: 'repo-2', fullName: 'acme/other', similarity: 0.91 }],
    }),
    checkRepoMembership: vi.fn().mockResolvedValue('member'),
    ...overrides,
  };
}

function createDependencies(
  store: McpUserStore,
  overrides: Partial<McpHandlerDependencies> = {},
): McpHandlerDependencies {
  const principal: AuthenticatedPrincipal = {
    userId: 'user-1',
    jwt: 'oauth-jwt-token',
    scopes: ['openid', 'profile'],
  };
  return {
    resourceUrl: 'https://demo.supabase.co/functions/v1/mcp',
    authorizationServerUrl: 'https://demo.supabase.co/auth/v1',
    authenticate: vi.fn().mockResolvedValue(principal),
    createUserStore: vi.fn().mockReturnValue(store),
    fetchGitHub: vi.fn().mockResolvedValue(
      new Response('# README\nHello world', {
        status: 200,
      }),
    ),
    ...overrides,
  };
}

function mcpPost(body: Record<string, unknown>, token?: string): Request {
  return new Request('https://demo.supabase.co/functions/v1/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function parseMcpResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('Content-Type') ?? '';
  const text = await response.text();
  if (contentType.includes('text/event-stream')) {
    const dataLine = text.split(/\r?\n/).find((line) => line.startsWith('data: '));
    if (!dataLine) {
      throw new Error(`Expected SSE data line in response: ${text}`);
    }
    return JSON.parse(dataLine.slice('data: '.length)) as T;
  }
  return JSON.parse(text) as T;
}

describe('mcp Edge Function HTTP & OAuth 2.1 boundary', () => {
  it('serves RFC 9728 OAuth protected resource metadata without auth', async () => {
    const store = createMockStore();
    const handler = createMcpHttpHandler(createDependencies(store));

    const res = await handler(
      new Request('https://demo.supabase.co/mcp/.well-known/oauth-protected-resource'),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      resource: 'https://demo.supabase.co/functions/v1/mcp',
      authorization_servers: ['https://demo.supabase.co/auth/v1'],
      bearer_methods_supported: ['header'],
      scopes_supported: ['openid', 'profile', 'email'],
    });
  });

  it('returns 401 with WWW-Authenticate challenge when Bearer token is missing or invalid', async () => {
    const store = createMockStore();
    const deps = createDependencies(store, {
      authenticate: vi.fn().mockResolvedValue(null),
    });
    const handler = createMcpHttpHandler(deps);

    const missing = await handler(mcpPost({ jsonrpc: '2.0', id: '1', method: 'tools/list' }));
    expect(missing.status).toBe(401);
    expect(missing.headers.get('WWW-Authenticate')).toBe(
      'Bearer resource_metadata="https://demo.supabase.co/functions/v1/mcp/.well-known/oauth-protected-resource"',
    );

    const invalid = await handler(
      mcpPost({ jsonrpc: '2.0', id: '1', method: 'tools/list' }, 'bad-token'),
    );
    expect(invalid.status).toBe(401);
    expect(invalid.headers.get('WWW-Authenticate')).toContain('error="invalid_token"');
  });

  it('lists 7 read-only tools with readOnlyHint annotations', async () => {
    const store = createMockStore();
    const handler = createMcpHttpHandler(createDependencies(store));

    const res = await handler(mcpPost({ jsonrpc: '2.0', id: '1', method: 'tools/list' }, 'good'));
    expect(res.status).toBe(200);
    const payload = await parseMcpResponse<{
      result: { tools: { name: string; annotations?: { readOnlyHint?: boolean } }[] };
    }>(res);
    const names = payload.result.tools.map((tool) => tool.name);
    expect(names).toEqual([
      'get_library_summary',
      'search_stars',
      'get_repo',
      'list_collections',
      'get_collection',
      'get_related_repos',
      'read_repo_readme',
    ]);
    for (const tool of payload.result.tools) {
      expect(tool.annotations?.readOnlyHint).toBe(true);
    }
  });

  it('executes search_stars and get_repo using caller-scoped store', async () => {
    const store = createMockStore();
    const deps = createDependencies(store);
    const handler = createMcpHttpHandler(deps);

    const searchRes = await handler(
      mcpPost(
        {
          jsonrpc: '2.0',
          id: '2',
          method: 'tools/call',
          params: { name: 'search_stars', arguments: { query: 'mcp', sort: 'relevance' } },
        },
        'good',
      ),
    );
    expect(searchRes.status).toBe(200);
    expect(store.searchRepos).toHaveBeenCalledWith({ query: 'mcp', sort: 'relevance' });

    const repoRes = await handler(
      mcpPost(
        {
          jsonrpc: '2.0',
          id: '3',
          method: 'tools/call',
          params: { name: 'get_repo', arguments: { fullName: 'acme/mcp-kit' } },
        },
        'good',
      ),
    );
    const repoJson = await parseMcpResponse<{
      result: { content: { text: string }[]; isError?: boolean };
    }>(repoRes);
    expect(repoJson.result.isError).toBeUndefined();
    expect(repoJson.result.content[0]?.text).toContain('Great schema adapter');
  });

  it('blocks read_repo_readme for repositories outside the user library before calling GitHub', async () => {
    const store = createMockStore({
      checkRepoMembership: vi.fn().mockResolvedValue('not_member'),
    });
    const deps = createDependencies(store);
    const handler = createMcpHttpHandler(deps);

    const res = await handler(
      mcpPost(
        {
          jsonrpc: '2.0',
          id: '4',
          method: 'tools/call',
          params: { name: 'read_repo_readme', arguments: { fullName: 'other/secret' } },
        },
        'good',
      ),
    );
    const body = await parseMcpResponse<{
      result: { content: { text: string }[]; isError?: boolean };
    }>(res);
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0]?.text).toContain('not in your Asterism library');
    expect(deps.fetchGitHub).not.toHaveBeenCalled();
  });

  it('fetches raw markdown README and truncates cleanly when exceeding maxChars', async () => {
    const store = createMockStore();
    const longReadme = `# Title\n${'a'.repeat(1200)}`;
    const deps = createDependencies(store, {
      resolveGitHubToken: vi.fn().mockResolvedValue('gh-user-token'),
      fetchGitHub: vi.fn().mockResolvedValue(new Response(longReadme, { status: 200 })),
    });
    const handler = createMcpHttpHandler(deps);

    const res = await handler(
      mcpPost(
        {
          jsonrpc: '2.0',
          id: '5',
          method: 'tools/call',
          params: {
            name: 'read_repo_readme',
            arguments: { fullName: 'acme/mcp-kit', maxChars: 500 },
          },
        },
        'good',
      ),
    );
    const body = await parseMcpResponse<{
      result: { content: { text: string }[]; isError?: boolean };
    }>(res);
    expect(body.result.isError).toBeUndefined();
    const parsed = JSON.parse(body.result.content[0]?.text ?? '{}') as {
      truncated: boolean;
      returnedChars: number;
      markdown: string;
    };
    expect(parsed.truncated).toBe(true);
    expect(parsed.returnedChars).toBe(500);
    expect(parsed.markdown.length).toBe(500);
    expect(deps.fetchGitHub).toHaveBeenCalledWith(
      'https://api.github.com/repos/acme/mcp-kit/readme',
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/vnd.github.raw+json',
          Authorization: 'Bearer gh-user-token',
        }),
      }),
    );
  });

  it('executes get_library_summary, list_collections, get_collection, and get_related_repos', async () => {
    const store = createMockStore();
    const handler = createMcpHttpHandler(createDependencies(store));

    const summaryRes = await handler(
      mcpPost(
        {
          jsonrpc: '2.0',
          id: '6',
          method: 'tools/call',
          params: { name: 'get_library_summary', arguments: {} },
        },
        'good',
      ),
    );
    const summaryBody = await parseMcpResponse<{ result: { content: { text: string }[] } }>(
      summaryRes,
    );
    expect(summaryBody.result.content[0]?.text).toContain('"activeStars": 12');

    const collectionsRes = await handler(
      mcpPost(
        {
          jsonrpc: '2.0',
          id: '7',
          method: 'tools/call',
          params: { name: 'list_collections', arguments: {} },
        },
        'good',
      ),
    );
    expect(collectionsRes.status).toBe(200);
    expect(store.listCollections).toHaveBeenCalled();

    const collectionRes = await handler(
      mcpPost(
        {
          jsonrpc: '2.0',
          id: '8',
          method: 'tools/call',
          params: { name: 'get_collection', arguments: { name: 'MCP' } },
        },
        'good',
      ),
    );
    expect(collectionRes.status).toBe(200);
    expect(store.getCollection).toHaveBeenCalledWith({ name: 'MCP' });

    const relatedRes = await handler(
      mcpPost(
        {
          jsonrpc: '2.0',
          id: '9',
          method: 'tools/call',
          params: { name: 'get_related_repos', arguments: { fullName: 'acme/mcp-kit', limit: 3 } },
        },
        'good',
      ),
    );
    expect(relatedRes.status).toBe(200);
    expect(store.getRelatedRepos).toHaveBeenCalledWith({ fullName: 'acme/mcp-kit', limit: 3 });
  });
});
