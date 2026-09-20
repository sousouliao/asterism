import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createAskGenerateHandler } from './handler.ts';

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
  const allowedOrigins = (Deno.env.get('ASK_ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  const handler = createAskGenerateHandler({
    authenticate: async (jwt) => {
      const { data, error } = await admin.auth.getUser(jwt);
      return error ? null : (data.user?.id ?? null);
    },
    fetchProvider: fetch,
    allowedOrigins,
  });

  return handler(request);
});
