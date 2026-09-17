create extension if not exists pgtap with schema extensions;

begin;

select extensions.plan(8);

insert into auth.users (id, email)
values
  ('10000000-0000-4000-8000-000000000011', 'memory-a@example.test'),
  ('10000000-0000-4000-8000-000000000012', 'memory-b@example.test');

insert into public.repos (id, github_id, full_name, name, owner)
values ('20000000-0000-4000-8000-000000000011', 300000111, 'test/memory', 'memory', 'test');

insert into public.memories (
  user_id,
  repo_id,
  source,
  source_created_at,
  why_saved,
  note
)
values
  (
    '10000000-0000-4000-8000-000000000011',
    '20000000-0000-4000-8000-000000000011',
    'github_star',
    '2026-09-17T00:00:00Z',
    'Local-first research',
    'Try this later'
  ),
  (
    '10000000-0000-4000-8000-000000000012',
    '20000000-0000-4000-8000-000000000011',
    'github_star',
    null,
    null,
    null
  );

select extensions.has_table('public', 'memories', 'Memory table exists');
select extensions.hasnt_table('public', 'notes', 'legacy Notes table is retired');
select extensions.col_is_null(
  'public',
  'memories',
  'why_saved',
  'Why saved remains optional for legacy Stars'
);
select extensions.throws_ok(
  $$insert into public.memories (user_id, repo_id, source) values (
    '10000000-0000-4000-8000-000000000011',
    '20000000-0000-4000-8000-000000000011',
    'github_star'
  )$$,
  '23505',
  null,
  'one Memory is allowed per user and repository'
);

set request.jwt.claim.sub = '10000000-0000-4000-8000-000000000011';
set role authenticated;

select extensions.is(
  (select count(*) from public.memories),
  1::bigint,
  'a user can only read their own Memory'
);
select extensions.is(
  (select why_saved from public.memories where repo_id = '20000000-0000-4000-8000-000000000011'),
  'Local-first research',
  'a user can read their own personal context'
);
select extensions.lives_ok(
  $$update public.memories set why_saved = null, note = null where repo_id = '20000000-0000-4000-8000-000000000011'$$,
  'a user can clear personal fields without deleting the Memory'
);
select extensions.throws_ok(
  $$insert into public.memories (user_id, repo_id, source) values (
    '10000000-0000-4000-8000-000000000012',
    '20000000-0000-4000-8000-000000000011',
    'github_star'
  )$$,
  '42501',
  null,
  'a user cannot write another user Memory'
);

select * from extensions.finish();

rollback;
