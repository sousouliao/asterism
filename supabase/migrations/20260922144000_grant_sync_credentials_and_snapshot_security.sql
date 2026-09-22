-- 受信同步凭据表必须对 service_role 显式授权，且快照对账函数必须以 security definer 运行。
--
-- github_sync_credentials（20260922120000）只开启了 RLS 并 revoke anon, authenticated，
-- 但未显式授权给 service_role。Edge Function（sync-stars）和 pgTAP 测试在 service_role
-- 角色下执行直接读写与 apply_github_star_snapshot 时被拒绝：
-- permission denied for table github_sync_credentials。
--
-- 同时 apply_github_star_snapshot（20260922121500）需跨 repos、user_stars、
-- github_sync_credentials 与 ensure_user_memories 执行受信任事务级对账，
-- 需标记为 security definer，并保持仅允许 service_role 执行。

grant all on table public.github_sync_credentials to service_role;

create or replace function public.apply_github_star_snapshot(
  p_user_id uuid,
  p_rows jsonb,
  p_checked_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_unstarred integer;
begin
  if p_user_id is null or p_checked_at is null or jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'Invalid GitHub Star snapshot';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_rows) as incoming (github_id bigint, starred_at timestamptz)
    where incoming.github_id is null or incoming.starred_at is null
  ) then
    raise exception 'Incomplete GitHub Star snapshot';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_user_id::text));
  if exists (
    select 1 from public.github_sync_credentials
    where user_id = p_user_id and last_synced_at > p_checked_at
  ) then
    raise exception 'A newer GitHub Star snapshot is already applied';
  end if;

  insert into public.repos (
    github_id, full_name, name, owner, description, language, topics,
    stargazers, forks, homepage, pushed_at, repo_created_at, archived, is_fork, synced_at
  )
  select
    incoming.github_id, incoming.full_name, incoming.name, incoming.owner,
    incoming.description, incoming.language, incoming.topics, incoming.stargazers,
    incoming.forks, incoming.homepage, incoming.pushed_at, incoming.repo_created_at,
    incoming.archived, incoming.is_fork, p_checked_at
  from jsonb_to_recordset(p_rows) as incoming (
    github_id bigint, full_name text, name text, owner text, description text,
    language text, topics text[], stargazers integer, forks integer, homepage text,
    pushed_at timestamptz, repo_created_at timestamptz, archived boolean,
    is_fork boolean, starred_at timestamptz
  )
  on conflict (github_id) do update set
    full_name = excluded.full_name,
    name = excluded.name,
    owner = excluded.owner,
    description = excluded.description,
    language = excluded.language,
    topics = excluded.topics,
    stargazers = excluded.stargazers,
    forks = excluded.forks,
    homepage = excluded.homepage,
    pushed_at = excluded.pushed_at,
    repo_created_at = excluded.repo_created_at,
    archived = excluded.archived,
    is_fork = excluded.is_fork,
    synced_at = excluded.synced_at;

  insert into public.user_stars (user_id, repo_id, starred_at, unstarred_at)
  select p_user_id, repo.id, incoming.starred_at, null
  from jsonb_to_recordset(p_rows) as incoming (github_id bigint, starred_at timestamptz)
  join public.repos repo on repo.github_id = incoming.github_id
  on conflict (user_id, repo_id) do update set
    starred_at = excluded.starred_at,
    unstarred_at = null
  where public.user_stars.starred_at is distinct from excluded.starred_at
     or public.user_stars.unstarred_at is not null;

  perform public.ensure_user_memories(p_user_id);

  update public.user_stars
  set unstarred_at = p_checked_at
  where user_id = p_user_id
    and unstarred_at is null
    and not exists (
      select 1
      from jsonb_to_recordset(p_rows) as incoming (github_id bigint)
      join public.repos repo on repo.github_id = incoming.github_id
      where repo.id = public.user_stars.repo_id
    );
  get diagnostics v_unstarred = row_count;

  update public.github_sync_credentials
  set last_synced_at = p_checked_at, last_error = null
  where user_id = p_user_id;

  return jsonb_build_object(
    'total', jsonb_array_length(p_rows),
    'upserted', jsonb_array_length(p_rows),
    'starsLinked', jsonb_array_length(p_rows),
    'unstarred', v_unstarred
  );
end;
$$;

revoke all on function public.apply_github_star_snapshot(uuid, jsonb, timestamptz) from public;
grant execute on function public.apply_github_star_snapshot(uuid, jsonb, timestamptz) to service_role;
