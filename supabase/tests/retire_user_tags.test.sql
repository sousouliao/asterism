create extension if not exists pgtap with schema extensions;

begin;

select extensions.plan(4);

insert into auth.users (id, email)
values ('10000000-0000-4000-8000-000000000001', 'retire-tags@example.test');

insert into public.repos (id, github_id, full_name, name, owner)
values ('20000000-0000-4000-8000-000000000001', 300000101, 'test/retired', 'retired', 'test');

insert into public.user_stars (user_id, repo_id)
values ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001');

select extensions.hasnt_table(
  'public',
  'tags',
  'user tags are retired'
);

select extensions.hasnt_table(
  'public',
  'repo_tags',
  'repo tag memberships are retired'
);

select extensions.throws_ok(
  $$select public.create_bulk_operation(
    '10000000-0000-4000-8000-000000000001',
    'manual',
    'bulk_dialog',
    '11111111-1111-4111-8111-111111111111',
    array['20000000-0000-4000-8000-000000000001']::uuid[],
    '[{"relationType":"tag","targetId":"30000000-0000-4000-8000-000000000001","action":"add"}]'::jsonb
  )$$,
  'P0001',
  'target_not_owned',
  'new bulk operations reject relation_type tag'
);

select extensions.ok(
  exists(
    select 1
    from pg_constraint
    where conrelid = 'public.bulk_operation_items'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%tag%'
  ),
  'historical relation_type tag remains a legal ledger value'
);

select * from extensions.finish();

rollback;
