import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { Database } from '../../../packages/db/src/database.types.ts';
import { parseCsvOrigins, verifyBearerPrincipal } from '../_shared/auth.ts';
import {
  resolveOptionalStoredGitHubToken,
  type StoredGitHubCredentialRow,
} from '../_shared/github-credential.ts';
import { createMcpHttpHandler } from './handler.ts';
import type { McpUserStore } from './tools.ts';

Deno.serve(async (request: Request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Server is missing Supabase configuration' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const normalizedSupabaseUrl = supabaseUrl.replace(/\/+$/, '');
  const resourceUrl = Deno.env.get('MCP_PUBLIC_URL') || `${normalizedSupabaseUrl}/functions/v1/mcp`;
  const authorizationServerUrl =
    Deno.env.get('MCP_AUTH_ISSUER') || `${normalizedSupabaseUrl}/auth/v1`;
  const allowedOrigins = parseCsvOrigins(Deno.env.get('MCP_ALLOWED_ORIGINS'));

  const admin = createClient<Database>(normalizedSupabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const handler = createMcpHttpHandler({
    resourceUrl,
    authorizationServerUrl,
    allowedOrigins,
    authenticate: (jwt) => verifyBearerPrincipal(admin.auth, jwt),
    createUserStore: (principal): McpUserStore => {
      // 使用调用方 JWT 构造 RLS 作用域客户端；全部读取严格受 Postgres 行级安全约束。
      const userClient = createClient<Database>(normalizedSupabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${principal.jwt}` } },
      });

      return {
        async getLibrarySummary() {
          const { data, error } = await userClient.rpc('mcp_library_summary');
          if (error) throw error;
          return data;
        },
        async searchRepos(input) {
          const { data, error } = await userClient.rpc('mcp_search_repos', {
            p_query: input.query,
            p_language: input.language,
            p_topic: input.topic,
            p_collection_id: input.collectionId,
            p_include_archived: input.includeArchived,
            p_include_history: input.includeHistory,
            p_sort: input.sort,
            p_limit: input.limit,
            p_offset: input.offset,
          });
          if (error) throw error;
          return data;
        },
        async getRepo(input) {
          const { data, error } = await userClient.rpc('mcp_get_repo', {
            p_repo_id: input.repoId,
            p_full_name: input.fullName,
          });
          if (error) throw error;
          return data;
        },
        async listCollections() {
          const { data, error } = await userClient.rpc('mcp_list_collections');
          if (error) throw error;
          return data;
        },
        async getCollection(input) {
          const { data, error } = await userClient.rpc('mcp_get_collection', {
            p_collection_id: input.collectionId,
            p_name: input.name,
            p_limit: input.limit,
            p_offset: input.offset,
          });
          if (error) throw error;
          return data;
        },
        async getRelatedRepos(input) {
          const { data, error } = await userClient.rpc('mcp_related_repos', {
            p_repo_id: input.repoId,
            p_full_name: input.fullName,
            p_limit: input.limit,
          });
          if (error) throw error;
          return data;
        },
        async checkRepoMembership(fullName) {
          const { data, error } = await userClient
            .from('user_stars')
            .select('repo_id, repos!inner(full_name)')
            .eq('user_id', principal.userId)
            .ilike('repos.full_name', fullName)
            .limit(1)
            .maybeSingle();
          if (error) return 'error';
          return data ? 'member' : 'not_member';
        },
      };
    },
    resolveGitHubToken: (userId) =>
      resolveOptionalStoredGitHubToken(
        {
          readCiphertexts: async (targetUserId) => {
            const { data } = await admin
              .from('github_sync_credentials')
              .select('access_token_ciphertext, refresh_token_ciphertext')
              .eq('user_id', targetUserId)
              .maybeSingle<StoredGitHubCredentialRow>();
            return data ?? null;
          },
        },
        userId,
      ),
    fetchGitHub: fetch,
  });

  return handler(request);
});
