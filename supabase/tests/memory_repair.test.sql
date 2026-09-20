create extension if not exists pgtap with schema extensions;

begin;

select extensions.plan(6);

insert into auth.users (id, email)
values ('10000000-0000-4000-8000-000000000021', 'repair-a@example.test');

insert into public.repos (id, github_id, full_name, name, owner)
values
  ('20000000-0000-4000-8000-000000000021', 300000221, 'test/fresh', 'fresh', 'test'),
  ('20000000-0000-4000-8000-000000000022', 300000222, 'test/manual', 'manual', 'test'),
  ('20000000-0000-4000-8000-000000000023', 300000223, 'test/kept', 'kept', 'test');

insert into public.user_stars (user_id, repo_id, starred_at)
values
  (
    '10000000-0000-4000-8000-000000000021',
    '20000000-0000-4000-8000-000000000021',
    '2026-01-01T00:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000021',
    '20000000-0000-4000-8000-000000000022',
    '2026-02-02T00:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000021',
    '20000000-0000-4000-8000-000000000023',
    '2026-03-03T00:00:00Z'
  );

-- 用户在 sync 补齐之前就手工写过记忆：source_created_at 为空，内容不可被覆盖。
insert into public.memories (user_id, repo_id, source, source_created_at, why_saved, note)
values (
  '10000000-0000-4000-8000-000000000021',
  '20000000-0000-4000-8000-000000000022',
  'github_star',
  null,
  'Saved before the first sync',
  'Keep me'
);

-- 已有收藏时间的记录不应被改写。
insert into public.memories (user_id, repo_id, source, source_created_at)
values (
  '10000000-0000-4000-8000-000000000021',
  '20000000-0000-4000-8000-000000000023',
  'github_star',
  '2020-12-31T00:00:00Z'
);

select public.ensure_user_memories('10000000-0000-4000-8000-000000000021');

select extensions.is(
  (select count(*) from public.memories where user_id = '10000000-0000-4000-8000-000000000021'),
  3::bigint,
  'repair creates a base Memory for every Star'
);
select extensions.is(
  (
    select source_created_at from public.memories
    where repo_id = '20000000-0000-4000-8000-000000000021'
  ),
  '2026-01-01T00:00:00Z'::timestamptz,
  'a newly created Memory carries the star time'
);
select extensions.is(
  (
    select source_created_at from public.memories
    where repo_id = '20000000-0000-4000-8000-000000000022'
  ),
  '2026-02-02T00:00:00Z'::timestamptz,
  'a manually created Memory gets its missing star time backfilled'
);
select extensions.is(
  (select why_saved from public.memories where repo_id = '20000000-0000-4000-8000-000000000022'),
  'Saved before the first sync',
  'backfill never overwrites personal context'
);
select extensions.is(
  (
    select source_created_at from public.memories
    where repo_id = '20000000-0000-4000-8000-000000000023'
  ),
  '2020-12-31T00:00:00Z'::timestamptz,
  'an existing star time is left untouched'
);

set request.jwt.claim.sub = '10000000-0000-4000-8000-000000000021';
set role authenticated;

select extensions.throws_ok(
  $$select public.ensure_user_memories('10000000-0000-4000-8000-000000000099')$$,
  '42501',
  null,
  'a user cannot repair another user Memories'
);

select * from extensions.finish();

rollback;
