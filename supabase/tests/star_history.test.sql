create extension if not exists pgtap with schema extensions;

begin;
select extensions.plan(5);

insert into auth.users (id, email)
values ('10000000-0000-4000-8000-000000000051', 'history@example.test');
insert into public.repos (id, github_id, full_name, name, owner)
values
  ('20000000-0000-4000-8000-000000000051', 300000551, 'test/kept', 'kept', 'test'),
  ('20000000-0000-4000-8000-000000000052', 300000552, 'test/removed', 'removed', 'test');
insert into public.user_stars (user_id, repo_id, starred_at)
values
  ('10000000-0000-4000-8000-000000000051', '20000000-0000-4000-8000-000000000051', '2026-01-01T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000051', '20000000-0000-4000-8000-000000000052', '2026-01-02T00:00:00Z');
insert into public.memories (user_id, repo_id, note)
values ('10000000-0000-4000-8000-000000000051', '20000000-0000-4000-8000-000000000052', 'Keep this memory');

set role service_role;
select extensions.is(
  (public.apply_github_star_snapshot(
    '10000000-0000-4000-8000-000000000051',
    '[{"github_id":300000551,"full_name":"test/kept","name":"kept","owner":"test","description":null,"language":null,"topics":[],"stargazers":1,"forks":0,"homepage":null,"pushed_at":null,"repo_created_at":null,"archived":false,"is_fork":false,"starred_at":"2026-01-01T00:00:00Z"}]'::jsonb,
    '2026-09-22T00:00:00Z'
  )->>'unstarred')::integer,
  1,
  'complete snapshot marks one missing Star as history'
);
reset role;

select extensions.is(
  (select unstarred_at from public.user_stars where repo_id = '20000000-0000-4000-8000-000000000052'),
  '2026-09-22T00:00:00Z'::timestamptz,
  'history records detection time'
);
select extensions.is(
  (select note from public.memories where repo_id = '20000000-0000-4000-8000-000000000052'),
  'Keep this memory',
  'unstar does not delete Memory'
);
select extensions.is(
  (select count(*) from public.user_stars where unstarred_at is null),
  1::bigint,
  'present Star remains active'
);

set role service_role;
select public.apply_github_star_snapshot(
  '10000000-0000-4000-8000-000000000051',
  '[{"github_id":300000551,"full_name":"test/kept","name":"kept","owner":"test","description":null,"language":null,"topics":[],"stargazers":1,"forks":0,"homepage":null,"pushed_at":null,"repo_created_at":null,"archived":false,"is_fork":false,"starred_at":"2026-01-01T00:00:00Z"},{"github_id":300000552,"full_name":"test/removed","name":"removed","owner":"test","description":null,"language":null,"topics":[],"stargazers":1,"forks":0,"homepage":null,"pushed_at":null,"repo_created_at":null,"archived":false,"is_fork":false,"starred_at":"2026-09-23T00:00:00Z"}]'::jsonb,
  '2026-09-23T00:00:00Z'
);
reset role;
select extensions.is(
  (select count(*) from public.memories where repo_id = '20000000-0000-4000-8000-000000000052' and note = 'Keep this memory' and source_created_at is not null),
  1::bigint,
  're-star reuses the original Memory'
);

select * from extensions.finish();
rollback;
