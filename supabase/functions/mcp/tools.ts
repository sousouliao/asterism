import { type Ctx as McpContext, McpServer, type ToolCallResult } from 'mcp-lite';
import { z } from 'zod';
import type { AuthenticatedPrincipal } from '../_shared/auth.ts';

export const MCP_README_DEFAULT_MAX_CHARS = 24_000;
export const MCP_README_MAX_CHARS_LIMIT = 48_000;

export interface SearchStarsInput {
  query?: string;
  language?: string;
  topic?: string;
  collectionId?: string;
  includeArchived?: boolean;
  includeHistory?: boolean;
  sort?: 'starred' | 'pushed' | 'stars' | 'name' | 'relevance';
  limit?: number;
  offset?: number;
}

export interface RepoLookupInput {
  repoId?: string;
  fullName?: string;
}

export interface GetCollectionInput {
  collectionId?: string;
  name?: string;
  limit?: number;
  offset?: number;
}

export interface RelatedReposInput {
  repoId?: string;
  fullName?: string;
  limit?: number;
}

export type RepoMembership = 'member' | 'not_member' | 'error';

export interface McpUserStore {
  getLibrarySummary: () => Promise<unknown>;
  searchRepos: (input: SearchStarsInput) => Promise<unknown>;
  getRepo: (input: RepoLookupInput) => Promise<unknown | null>;
  listCollections: () => Promise<unknown>;
  getCollection: (input: GetCollectionInput) => Promise<unknown | null>;
  getRelatedRepos: (input: RelatedReposInput) => Promise<unknown | null>;
  checkRepoMembership: (fullName: string) => Promise<RepoMembership>;
}

export interface McpToolsDependencies {
  createUserStore: (principal: AuthenticatedPrincipal) => McpUserStore;
  resolveGitHubToken?: (userId: string) => Promise<string | undefined>;
  fetchGitHub: typeof fetch;
}

const READ_ONLY_LIBRARY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const READ_ONLY_EXTERNAL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

function textResult(payload: unknown, isError = false): ToolCallResult {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
  return {
    content: [{ type: 'text', text }],
    ...(isError ? { isError: true } : {}),
  };
}

function principalFromContext(ctx: McpContext): AuthenticatedPrincipal | null {
  const token = ctx.authInfo?.token;
  const userId = ctx.authInfo?.extra?.userId;
  if (typeof token !== 'string' || !token || typeof userId !== 'string' || !userId) {
    return null;
  }
  return {
    jwt: token,
    userId,
    scopes: ctx.authInfo?.scopes ?? [],
    ...(ctx.authInfo?.expiresAt !== undefined ? { expiresAt: ctx.authInfo.expiresAt } : {}),
  };
}

function isRepoSegment(value: string): boolean {
  return value.length > 0 && value.length <= 100 && /^[\w.-]+$/.test(value);
}

function parseRepoTarget(input: {
  fullName?: string;
  owner?: string;
  name?: string;
}): { owner: string; name: string } | null {
  if (input.fullName) {
    const trimmed = input.fullName.trim();
    const parts = trimmed.split('/');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return null;
    }
    if (!isRepoSegment(parts[0]) || !isRepoSegment(parts[1])) {
      return null;
    }
    return { owner: parts[0], name: parts[1] };
  }
  if (input.owner && input.name) {
    const owner = input.owner.trim();
    const name = input.name.trim();
    if (!isRepoSegment(owner) || !isRepoSegment(name)) {
      return null;
    }
    return { owner, name };
  }
  return null;
}

const emptyInputSchema = z.object({});

const searchStarsSchema = z.object({
  query: z
    .string()
    .max(200)
    .optional()
    .describe('Keyword query matched against repo name, description, topics, whySaved, and note.'),
  language: z.string().max(80).optional().describe('Exact programming language filter, e.g. Rust.'),
  topic: z.string().max(80).optional().describe('Exact GitHub topic filter.'),
  collectionId: z.string().uuid().optional().describe('Filter to repositories in this collection.'),
  includeArchived: z.boolean().optional().describe('Include archived repositories (default true).'),
  includeHistory: z
    .boolean()
    .optional()
    .describe('Include previously unstarred historical repositories (default false).'),
  sort: z
    .enum(['starred', 'pushed', 'stars', 'name', 'relevance'])
    .optional()
    .describe('Sort order (default starred). Use relevance when ranking keyword matches.'),
  limit: z.number().int().min(1).max(50).optional().describe('Page size (1-50, default 20).'),
  offset: z.number().int().min(0).optional().describe('Pagination offset (default 0).'),
});

const repoTargetSchema = z
  .object({
    repoId: z.string().uuid().optional().describe('Asterism repository UUID.'),
    fullName: z.string().max(205).optional().describe('GitHub owner/name, e.g. vercel/next.js.'),
  })
  .refine((value) => Boolean(value.repoId || value.fullName?.trim()), {
    message: 'Provide either repoId or fullName.',
  });

const getCollectionSchema = z
  .object({
    collectionId: z.string().uuid().optional().describe('Collection UUID.'),
    name: z.string().max(120).optional().describe('Exact collection name (case-insensitive).'),
    limit: z.number().int().min(1).max(50).optional().describe('Page size (1-50, default 30).'),
    offset: z.number().int().min(0).optional().describe('Pagination offset (default 0).'),
  })
  .refine((value) => Boolean(value.collectionId || value.name?.trim()), {
    message: 'Provide either collectionId or name.',
  });

const relatedReposSchema = z
  .object({
    repoId: z.string().uuid().optional().describe('Anchor repository UUID.'),
    fullName: z.string().max(205).optional().describe('Anchor GitHub owner/name.'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(12)
      .optional()
      .describe('Max related items (1-12, default 5).'),
  })
  .refine((value) => Boolean(value.repoId || value.fullName?.trim()), {
    message: 'Provide either repoId or fullName.',
  });

const readReadmeSchema = z
  .object({
    fullName: z.string().max(205).optional().describe('GitHub owner/name, e.g. astral-sh/uv.'),
    owner: z.string().max(100).optional().describe('GitHub repository owner.'),
    name: z.string().max(100).optional().describe('GitHub repository name.'),
    maxChars: z
      .number()
      .int()
      .min(500)
      .max(MCP_README_MAX_CHARS_LIMIT)
      .optional()
      .describe(`Max Markdown characters to return (default ${MCP_README_DEFAULT_MAX_CHARS}).`),
  })
  .refine((value) => Boolean(value.fullName || (value.owner && value.name)), {
    message: 'Provide fullName or both owner and name.',
  });

export function createAsterismMcpServer(dependencies: McpToolsDependencies): McpServer {
  const server = new McpServer({
    name: 'asterism-memory',
    version: '0.1.0',
    schemaAdapter: (schema) => z.toJSONSchema(schema as z.ZodType),
  });

  function withStore(
    ctx: McpContext,
    run: (store: McpUserStore, principal: AuthenticatedPrincipal) => Promise<ToolCallResult>,
  ): Promise<ToolCallResult> {
    const principal = principalFromContext(ctx);
    if (!principal) {
      return Promise.resolve(textResult('Authentication required.', true));
    }
    const store = dependencies.createUserStore(principal);
    return run(store, principal);
  }

  server.tool('get_library_summary', {
    title: 'Get Library Summary',
    description:
      'Get an overview of the user starred library: active/historical counts, annotated memory count, top languages, top topics, and collections.',
    annotations: READ_ONLY_LIBRARY_ANNOTATIONS,
    inputSchema: emptyInputSchema,
    handler: (_args, ctx) =>
      withStore(ctx, async (store) => {
        const summary = await store.getLibrarySummary();
        return textResult(summary);
      }),
  });

  server.tool('search_stars', {
    title: 'Search Stars & Memories',
    description:
      'Search and filter the user starred repositories and personal memories (whySaved, note) by keyword, language, topic, or collection.',
    annotations: READ_ONLY_LIBRARY_ANNOTATIONS,
    inputSchema: searchStarsSchema,
    handler: (args, ctx) =>
      withStore(ctx, async (store) => {
        const result = await store.searchRepos(args);
        return textResult(result);
      }),
  });

  server.tool('get_repo', {
    title: 'Get Repository & Memory',
    description:
      'Get full metadata, star/unstar status, personal Memory (whySaved and note), and collections for a repository in the user library.',
    annotations: READ_ONLY_LIBRARY_ANNOTATIONS,
    inputSchema: repoTargetSchema,
    handler: (args, ctx) =>
      withStore(ctx, async (store) => {
        const repo = await store.getRepo({
          ...(args.repoId ? { repoId: args.repoId } : {}),
          ...(args.fullName ? { fullName: args.fullName.trim() } : {}),
        });
        if (!repo) {
          return textResult('Repository not found in your Asterism library.', true);
        }
        return textResult(repo);
      }),
  });

  server.tool('list_collections', {
    title: 'List Collections',
    description: 'List all user collections with descriptions and repository counts.',
    annotations: READ_ONLY_LIBRARY_ANNOTATIONS,
    inputSchema: emptyInputSchema,
    handler: (_args, ctx) =>
      withStore(ctx, async (store) => {
        const collections = await store.listCollections();
        return textResult({ collections });
      }),
  });

  server.tool('get_collection', {
    title: 'Get Collection Repositories',
    description:
      'Get a collection by ID or name along with its paginated repositories and memories.',
    annotations: READ_ONLY_LIBRARY_ANNOTATIONS,
    inputSchema: getCollectionSchema,
    handler: (args, ctx) =>
      withStore(ctx, async (store) => {
        const collection = await store.getCollection({
          ...(args.collectionId ? { collectionId: args.collectionId } : {}),
          ...(args.name ? { name: args.name.trim() } : {}),
          ...(args.limit !== undefined ? { limit: args.limit } : {}),
          ...(args.offset !== undefined ? { offset: args.offset } : {}),
        });
        if (!collection) {
          return textResult('Collection not found.', true);
        }
        return textResult(collection);
      }),
  });

  server.tool('get_related_repos', {
    title: 'Get Related Starred Repositories',
    description:
      'Find repositories in the user library related to a given starred repository, using stored semantic embeddings when available or topic/language/collection overlap otherwise.',
    annotations: READ_ONLY_LIBRARY_ANNOTATIONS,
    inputSchema: relatedReposSchema,
    handler: (args, ctx) =>
      withStore(ctx, async (store) => {
        const related = await store.getRelatedRepos({
          ...(args.repoId ? { repoId: args.repoId } : {}),
          ...(args.fullName ? { fullName: args.fullName.trim() } : {}),
          ...(args.limit !== undefined ? { limit: args.limit } : {}),
        });
        if (!related) {
          return textResult('Anchor repository not found in your Asterism library.', true);
        }
        return textResult(related);
      }),
  });

  server.tool('read_repo_readme', {
    title: 'Read Repository README',
    description:
      'Fetch the live README Markdown from GitHub for a repository in the user Asterism library. Never stored in Asterism database.',
    annotations: READ_ONLY_EXTERNAL_ANNOTATIONS,
    inputSchema: readReadmeSchema,
    handler: (args, ctx) =>
      withStore(ctx, async (store, principal) => {
        const target = parseRepoTarget(args);
        if (!target) {
          return textResult('Invalid repository owner/name.', true);
        }
        const fullName = `${target.owner}/${target.name}`;
        const membership = await store.checkRepoMembership(fullName);
        if (membership === 'error') {
          return textResult('Failed to verify repository membership.', true);
        }
        if (membership === 'not_member') {
          return textResult('Repository is not in your Asterism library.', true);
        }

        const token = dependencies.resolveGitHubToken
          ? await dependencies.resolveGitHubToken(principal.userId)
          : undefined;
        const headers: Record<string, string> = {
          Accept: 'application/vnd.github.raw+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'asterism-mcp-read-readme',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };

        let response: Response;
        try {
          response = await dependencies.fetchGitHub(
            `https://api.github.com/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.name)}/readme`,
            { headers },
          );
        } catch {
          return textResult('Failed to reach GitHub API for README.', true);
        }

        if (response.status === 404) {
          return textResult('README not found on GitHub.', true);
        }
        if (response.status === 401) {
          return textResult(
            'Stored GitHub connection expired; reconnect GitHub in Asterism to read private or rate-limited READMEs.',
            true,
          );
        }
        if (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') {
          return textResult('GitHub API rate limit exceeded; retry later.', true);
        }
        if (!response.ok) {
          return textResult(`GitHub API returned HTTP ${response.status}.`, true);
        }

        const rawMarkdown = await response.text();
        const maxChars = args.maxChars ?? MCP_README_DEFAULT_MAX_CHARS;
        const truncated = rawMarkdown.length > maxChars;
        const markdown = truncated ? rawMarkdown.slice(0, maxChars) : rawMarkdown;

        return textResult({
          fullName,
          truncated,
          totalChars: rawMarkdown.length,
          returnedChars: markdown.length,
          markdown,
        });
      }),
  });

  return server;
}
