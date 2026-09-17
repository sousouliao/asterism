// Edge Function: sync-stars
//
// 受信路径写入（service role），见 knowledge/decisions/0006-stars-sync-edge-function.md。
// 流程：校验调用者 JWT → 取 user_id；用会话传入的 GitHub provider_token 调 GraphQL 拉取
// starred（支持增量）；service role 幂等 upsert repos（按 github_id）+ 该用户 user_stars。
//
// 注意：纯查询/映射逻辑与 packages/core/src/github/stars.ts 同源，以该处单测为权威。
// 因 Supabase Edge（Deno）与 workspace 打包边界，这里就近内联一份实现。

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ensureUserMemories } from './memory-sync.ts';

const GITHUB_GRAPHQL_ENDPOINT = 'https://api.github.com/graphql';
const STARRED_PAGE_SIZE = 100;
const UPSERT_CHUNK_SIZE = 500;

const STARRED_REPOS_QUERY = `
query StarredRepos($cursor: String, $pageSize: Int!) {
  viewer {
    starredRepositories(
      first: $pageSize
      after: $cursor
      orderBy: { field: STARRED_AT, direction: DESC }
    ) {
      pageInfo { hasNextPage endCursor }
      edges {
        starredAt
        node {
          databaseId
          name
          nameWithOwner
          owner { login }
          description
          primaryLanguage { name }
          repositoryTopics(first: 20) { nodes { topic { name } } }
          stargazerCount
          forkCount
          homepageUrl
          pushedAt
          createdAt
          isArchived
          isFork
        }
      }
    }
  }
}`;

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface StarEdge {
  starredAt: string;
  node: {
    databaseId: number | null;
    name: string;
    nameWithOwner: string;
    owner: { login: string };
    description: string | null;
    primaryLanguage: { name: string } | null;
    repositoryTopics: { nodes: { topic: { name: string } }[] };
    stargazerCount: number;
    forkCount: number;
    homepageUrl: string | null;
    pushedAt: string | null;
    createdAt: string | null;
    isArchived: boolean;
    isFork: boolean;
  };
}

interface GraphQLResponse {
  data?: {
    viewer: {
      starredRepositories: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        edges: StarEdge[];
      };
    };
  };
  errors?: { message: string }[];
}

interface RepoRow {
  github_id: number;
  full_name: string;
  name: string;
  owner: string;
  description: string | null;
  language: string | null;
  topics: string[];
  stargazers: number;
  forks: number;
  homepage: string | null;
  pushed_at: string | null;
  repo_created_at: string | null;
  archived: boolean;
  is_fork: boolean;
  synced_at: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function mapEdgeToRow(edge: StarEdge, syncedAt: string): RepoRow {
  const { node } = edge;
  return {
    github_id: node.databaseId ?? 0,
    full_name: node.nameWithOwner,
    name: node.name,
    owner: node.owner.login,
    description: node.description,
    language: node.primaryLanguage?.name ?? null,
    topics: node.repositoryTopics.nodes.map((entry) => entry.topic.name),
    stargazers: node.stargazerCount,
    forks: node.forkCount,
    homepage: node.homepageUrl,
    pushed_at: node.pushedAt,
    repo_created_at: node.createdAt,
    archived: node.isArchived,
    is_fork: node.isFork,
    synced_at: syncedAt,
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

async function fetchStarredPage(
  token: string,
  cursor: string | null,
): Promise<{ edges: StarEdge[]; hasNextPage: boolean; endCursor: string | null }> {
  const response = await fetch(GITHUB_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'asterism-sync-stars',
    },
    body: JSON.stringify({
      query: STARRED_REPOS_QUERY,
      variables: { cursor, pageSize: STARRED_PAGE_SIZE },
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub GraphQL responded with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as GraphQLResponse;
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((entry) => entry.message).join('; '));
  }
  const connection = payload.data?.viewer.starredRepositories;
  if (!connection) {
    throw new Error('GitHub GraphQL response was malformed');
  }
  return {
    edges: connection.edges,
    hasNextPage: connection.pageInfo.hasNextPage,
    endCursor: connection.pageInfo.endCursor,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Server is missing Supabase service configuration' }, 500);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!jwt) {
    return json({ error: 'Missing Authorization bearer token' }, 401);
  }

  let providerToken = '';
  try {
    const body = (await req.json()) as { providerToken?: string };
    providerToken = body.providerToken ?? '';
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  if (!providerToken) {
    return json({ error: 'Missing GitHub provider token' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  if (userError || !userData.user) {
    return json({ error: 'Invalid or expired session' }, 401);
  }
  const userId = userData.user.id;
  const memoryStore = {
    listUserStars: async (targetUserId: string, from: number, to: number) => {
      const { data, error } = await admin
        .from('user_stars')
        .select('repo_id, starred_at')
        .eq('user_id', targetUserId)
        .order('id', { ascending: true })
        .range(from, to);
      return { data, error };
    },
    insertMissingMemories: async (
      memoryRows: Array<{
        user_id: string;
        repo_id: string;
        source: 'github_star';
        source_created_at: string | null;
      }>,
    ) => {
      const { error } = await admin
        .from('memories')
        .upsert(memoryRows, { onConflict: 'user_id,repo_id', ignoreDuplicates: true });
      return { error };
    },
  };

  // 增量界：该用户已有的最新 starredAt。
  const { data: latest, error: latestError } = await admin
    .from('user_stars')
    .select('starred_at')
    .eq('user_id', userId)
    .order('starred_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (latestError) {
    return json({ error: `Failed to read existing stars: ${latestError.message}` }, 500);
  }
  const sinceMs = latest?.starred_at ? Date.parse(latest.starred_at) : null;
  const incremental = sinceMs !== null && Number.isFinite(sinceMs);

  // 拉取 GitHub starred（倒序），遇到不晚于 since 的项即停。
  const rows: RepoRow[] = [];
  const starredAtByGithubId = new Map<number, string>();
  let cursor: string | null = null;
  const syncedAt = new Date().toISOString();

  try {
    walk: for (;;) {
      const page = await fetchStarredPage(providerToken, cursor);
      for (const edge of page.edges) {
        const githubId = edge.node.databaseId ?? 0;
        if (githubId <= 0) {
          continue;
        }
        if (incremental && Date.parse(edge.starredAt) <= (sinceMs as number)) {
          break walk;
        }
        rows.push(mapEdgeToRow(edge, syncedAt));
        starredAtByGithubId.set(githubId, edge.starredAt);
      }
      if (!page.hasNextPage || !page.endCursor) {
        break;
      }
      cursor = page.endCursor;
    }
  } catch (cause) {
    return json({ error: `GitHub sync failed: ${(cause as Error).message}` }, 502);
  }

  if (rows.length === 0) {
    try {
      await ensureUserMemories(memoryStore, userId);
    } catch (cause) {
      return json({ error: (cause as Error).message }, 500);
    }
    return json({
      total: 0,
      upserted: 0,
      starsLinked: 0,
      incremental,
    });
  }

  // 幂等 upsert repos（按 github_id），收集 id 映射。
  const repoIdByGithubId = new Map<number, string>();
  for (const batch of chunk(rows, UPSERT_CHUNK_SIZE)) {
    const { data: upserted, error: upsertError } = await admin
      .from('repos')
      .upsert(batch, { onConflict: 'github_id' })
      .select('id, github_id');
    if (upsertError) {
      return json({ error: `Failed to upsert repos: ${upsertError.message}` }, 500);
    }
    for (const repo of upserted ?? []) {
      repoIdByGithubId.set(repo.github_id as number, repo.id as string);
    }
  }

  // 幂等 upsert 该用户的 user_stars（按 user_id + repo_id）。
  const starRows = rows
    .map((row) => {
      const repoId = repoIdByGithubId.get(row.github_id);
      if (!repoId) {
        return null;
      }
      return {
        user_id: userId,
        repo_id: repoId,
        starred_at: starredAtByGithubId.get(row.github_id) ?? null,
      };
    })
    .filter(
      (value): value is { user_id: string; repo_id: string; starred_at: string | null } =>
        value !== null,
    );

  let starsLinked = 0;
  for (const batch of chunk(starRows, UPSERT_CHUNK_SIZE)) {
    const { error: starError } = await admin
      .from('user_stars')
      .upsert(batch, { onConflict: 'user_id,repo_id' });
    if (starError) {
      return json({ error: `Failed to link user stars: ${starError.message}` }, 500);
    }
    starsLinked += batch.length;
  }

  try {
    await ensureUserMemories(memoryStore, userId);
  } catch (cause) {
    return json({ error: (cause as Error).message }, 500);
  }

  return json({
    total: rows.length,
    upserted: repoIdByGithubId.size,
    starsLinked,
    incremental,
  });
});
