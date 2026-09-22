// Edge Function: sync-stars
//
// 受信路径写入（service role），见 knowledge/decisions/0006-stars-sync-edge-function.md。
// 流程：验证用户 JWT 或调度密钥，取得 GitHub 凭据并拉取完整 Star 快照，
// 然后通过 service role 在单个数据库事务中完成对账。
//
// 注意：纯查询/映射逻辑与 packages/core/src/github/stars.ts 同源，以该处单测为权威。
// 因 Supabase Edge（Deno）与 workspace 打包边界，这里就近内联一份实现。

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  decryptCredential,
  encryptCredential,
  GitHubRefreshError,
  refreshGitHubToken,
} from './credential.ts';

const GITHUB_GRAPHQL_ENDPOINT = 'https://api.github.com/graphql';
const STARRED_PAGE_SIZE = 100;

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

interface StoredCredential {
  access_token_ciphertext: string;
  refresh_token_ciphertext: string | null;
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
  starred_at: string;
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
    starred_at: edge.starredAt,
  };
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

  let body: { providerToken?: string; providerRefreshToken?: string; userId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const schedulerSecret = Deno.env.get('GITHUB_SYNC_SCHEDULER_SECRET');
  const scheduled = Boolean(
    schedulerSecret && req.headers.get('X-Asterism-Scheduler') === schedulerSecret,
  );
  let userId: string;
  let providerToken: string;
  let providerRefreshToken: string | null = null;
  let expectedGitHubId: string | null = null;
  if (scheduled) {
    if (!body.userId || !/^[0-9a-f-]{36}$/i.test(body.userId)) {
      return json({ error: 'Invalid scheduled user' }, 400);
    }
    userId = body.userId;
    const { data, error } = await admin
      .from('github_sync_credentials')
      .select('access_token_ciphertext, refresh_token_ciphertext')
      .eq('user_id', userId)
      .maybeSingle<StoredCredential>();
    if (error || !data) return json({ error: 'GitHub connection unavailable' }, 404);
    try {
      providerToken = await decryptCredential(data.access_token_ciphertext);
      providerRefreshToken = data.refresh_token_ciphertext
        ? await decryptCredential(data.refresh_token_ciphertext)
        : null;
    } catch {
      return json({ error: 'GitHub connection unavailable' }, 500);
    }
  } else {
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!jwt) return json({ error: 'Missing Authorization bearer token' }, 401);
    const { data: userData, error: userError } = await admin.auth.getUser(jwt);
    if (userError || !userData.user) {
      return json({ error: 'Invalid or expired session' }, 401);
    }
    userId = userData.user.id;
    const githubIdentity = userData.user.identities?.find(
      (identity) => identity.provider === 'github',
    );
    expectedGitHubId = githubIdentity?.identity_data?.sub ?? githubIdentity?.id ?? null;
    if (!expectedGitHubId) return json({ error: 'GitHub identity unavailable' }, 400);
    providerToken = body.providerToken ?? '';
    providerRefreshToken = body.providerRefreshToken ?? null;
    if (!providerToken) {
      const { data } = await admin
        .from('github_sync_credentials')
        .select('access_token_ciphertext, refresh_token_ciphertext')
        .eq('user_id', userId)
        .maybeSingle<StoredCredential>();
      if (!data) return json({ error: 'GitHub reconnect required' }, 409);
      try {
        providerToken = await decryptCredential(data.access_token_ciphertext);
        providerRefreshToken = data.refresh_token_ciphertext
          ? await decryptCredential(data.refresh_token_ciphertext)
          : null;
      } catch {
        return json({ error: 'GitHub reconnect required' }, 409);
      }
    }
  }
  let identityErrorStatus = 502;
  try {
    let identityResponse = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${providerToken}`, Accept: 'application/vnd.github+json' },
    });
    if (identityResponse.status === 401 && providerRefreshToken) {
      const refreshed = await refreshGitHubToken(providerRefreshToken);
      providerToken = refreshed.accessToken;
      providerRefreshToken = refreshed.refreshToken;
      identityResponse = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${providerToken}`,
          Accept: 'application/vnd.github+json',
        },
      });
    }
    if (identityResponse.status === 401) {
      identityErrorStatus = 401;
      throw new Error('GitHub connection expired');
    }
    if (!identityResponse.ok)
      throw new Error(`GitHub identity check failed: HTTP ${identityResponse.status}`);
    const identity = (await identityResponse.json()) as { id?: number };
    if (!identity.id || (expectedGitHubId && String(identity.id) !== expectedGitHubId)) {
      identityErrorStatus = 403;
      throw new Error('GitHub account does not match the signed-in user');
    }
  } catch (cause) {
    if (cause instanceof GitHubRefreshError && cause.requiresReconnect) identityErrorStatus = 401;
    if (identityErrorStatus === 401 && (scheduled || !body.providerToken)) {
      await admin
        .from('github_sync_credentials')
        .update({ last_error: 'reconnect_required' })
        .eq('user_id', userId);
    }
    return json({ error: (cause as Error).message }, identityErrorStatus);
  }
  try {
    const { error } = await admin.from('github_sync_credentials').upsert(
      {
        user_id: userId,
        access_token_ciphertext: await encryptCredential(providerToken),
        refresh_token_ciphertext: providerRefreshToken
          ? await encryptCredential(providerRefreshToken)
          : null,
        last_attempt_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
    if (error) throw error;
  } catch {
    return json({ error: 'Could not save GitHub connection' }, 500);
  }
  // 必须拉完全部页，才能从缺席的仓库推断取消 Star。
  const rows: RepoRow[] = [];
  let cursor: string | null = null;
  const syncedAt = new Date().toISOString();

  try {
    for (;;) {
      const page = await fetchStarredPage(providerToken, cursor);
      for (const edge of page.edges) {
        const githubId = edge.node.databaseId ?? 0;
        if (githubId <= 0) throw new Error('GitHub returned a repository without an ID');
        rows.push(mapEdgeToRow(edge, syncedAt));
      }
      if (page.hasNextPage && (!page.endCursor || page.endCursor === cursor)) {
        throw new Error('GitHub pagination ended before the final page');
      }
      if (!page.hasNextPage) {
        break;
      }
      cursor = page.endCursor;
    }
  } catch (cause) {
    await admin
      .from('github_sync_credentials')
      .update({ last_error: 'GitHub sync failed' })
      .eq('user_id', userId);
    return json({ error: `GitHub sync failed: ${(cause as Error).message}` }, 502);
  }

  // 一次数据库事务完成新增、复 Star、Memory 修复和取消 Star。
  const { data: result, error: reconcileError } = await admin.rpc('apply_github_star_snapshot', {
    p_user_id: userId,
    p_rows: rows,
    p_checked_at: syncedAt,
  });
  if (reconcileError || !result) {
    return json(
      { error: `Failed to reconcile stars: ${reconcileError?.message ?? 'empty result'}` },
      500,
    );
  }

  return json(result);
});
