import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  resolveOptionalStoredGitHubToken,
  type StoredGitHubCredentialRow,
} from '../_shared/github-credential.ts';
import { createReadRepoReadmeHandler, type MembershipResult } from './handler.ts';

Deno.serve(async (request: Request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Server is missing Supabase configuration' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const handler = createReadRepoReadmeHandler({
    authenticate: async (jwt) => {
      const { data, error } = await admin.auth.getUser(jwt);
      return error ? null : (data.user?.id ?? null);
    },
    checkMembership: async (userId, fullName): Promise<MembershipResult> => {
      const { data, error } = await admin
        .from('user_stars')
        .select('repo_id, repos!inner(full_name)')
        .eq('user_id', userId)
        .eq('repos.full_name', fullName)
        .limit(1)
        .maybeSingle();
      if (error) return 'error';
      return data ? 'member' : 'not_member';
    },
    fetchGitHub: fetch,
    resolveStoredToken: (userId) =>
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
  });

  return handler(request);
});
