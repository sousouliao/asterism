-- Only the trusted sync function can read encrypted GitHub credentials.
create table public.github_sync_credentials (
  user_id uuid primary key references auth.users (id) on delete cascade,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text,
  last_synced_at timestamptz,
  last_attempt_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);

alter table public.github_sync_credentials enable row level security;
revoke all on public.github_sync_credentials from anon, authenticated;

create index github_sync_credentials_due_idx
  on public.github_sync_credentials (last_attempt_at);

create function public.github_sync_status()
returns table (connected boolean, last_synced_at timestamptz, last_error text)
language sql stable security definer
set search_path = ''
as $$
  select credential.last_error is distinct from 'reconnect_required', credential.last_synced_at, credential.last_error
  from public.github_sync_credentials credential
  where credential.user_id = (select auth.uid())
  union all
  select false, null::timestamptz, null::text
  where not exists (
    select 1 from public.github_sync_credentials credential
    where credential.user_id = (select auth.uid())
  );
$$;

revoke all on function public.github_sync_status() from public;
grant execute on function public.github_sync_status() to authenticated;
