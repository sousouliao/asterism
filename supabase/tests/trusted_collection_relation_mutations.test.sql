create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;

select extensions.plan(20);

insert into auth.users (id, email)
values
  ('10000000-0000-4000-8000-000000000001', 'relation-a@example.test'),
  ('10000000-0000-4000-8000-000000000002', 'relation-b@example.test');

insert into public.repos (id, github_id, full_name, name, owner)
values
  ('20000000-0000-4000-8000-000000000001', 300000001, 'test/relation', 'relation', 'test'),
  ('20000000-0000-4000-8000-000000000002', 300000002, 'test/relation-two', 'relation-two', 'test');

insert into public.user_stars (user_id, repo_id)
values
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002');

insert into public.collections (id, user_id, name)
values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Concurrent'),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Baseline'),
  ('30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'Other user');

insert into public.collection_repos (user_id, collection_id, repo_id)
values (
  '10000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000001'
);

select extensions.is(
  (public.apply_collection_relation_mutation(
    '10000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000001',
    'add'
  )->>'effectiveChanged')::boolean,
  false,
  'a legacy membership is a no-op'
);
select extensions.is(
  (select version from public.collection_relation_heads
   where collection_id = '30000000-0000-4000-8000-000000000002'),
  1::bigint,
  'a legacy membership receives a version-one baseline head'
);
select extensions.ok(
  (select present and last_operation_item_id is null
   from public.collection_relation_heads
   where collection_id = '30000000-0000-4000-8000-000000000002'),
  'the baseline is present and has no fabricated operation identity'
);

do $concurrent_setup$
declare
  local_connection_string text := format(
    'hostaddr=%s port=%s dbname=%s user=postgres password=postgres require_auth=scram-sha-256',
    inet_server_addr(),
    current_setting('port'),
    current_database()
  );
begin
  perform extensions.dblink_connect('relation_add_a', local_connection_string);
  perform extensions.dblink_connect('relation_add_b', local_connection_string);
  perform extensions.dblink_send_query(
    'relation_add_a',
    $$select public.apply_collection_relation_mutation(
      '10000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      'add'
    )$$
  );
  perform extensions.dblink_send_query(
    'relation_add_b',
    $$select public.apply_collection_relation_mutation(
      '10000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      'add'
    )$$
  );
end
$concurrent_setup$;

create temporary table concurrent_results (receipt jsonb);
insert into concurrent_results
select receipt from extensions.dblink_get_result('relation_add_a') as response(receipt jsonb);
insert into concurrent_results
select receipt from extensions.dblink_get_result('relation_add_b') as response(receipt jsonb);
do $concurrent_cleanup$
begin
  perform extensions.dblink_disconnect('relation_add_a');
  perform extensions.dblink_disconnect('relation_add_b');
end
$concurrent_cleanup$;

select extensions.is(
  (select count(*) from concurrent_results where (receipt->>'effectiveChanged')::boolean),
  1::bigint,
  'only one concurrent add is effective'
);
select extensions.is(
  (select count(*) from public.collection_repos
   where collection_id = '30000000-0000-4000-8000-000000000001'),
  1::bigint,
  'concurrent adds create one canonical membership'
);
select extensions.is(
  (select version from public.collection_relation_heads
   where collection_id = '30000000-0000-4000-8000-000000000001'),
  1::bigint,
  'concurrent adds advance the head once'
);

set request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';
set role authenticated;

create temporary table first_receipt as
select public.mutate_collection_relation(
  '30000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'remove',
  '40000000-0000-4000-8000-000000000001'
) as receipt;

select extensions.is(
  public.mutate_collection_relation(
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'remove',
    '40000000-0000-4000-8000-000000000001'
  ),
  (select receipt from first_receipt),
  'response-loss replay returns the exact original receipt'
);
select extensions.is(
  (select count(*) from public.bulk_operations
   where client_request_id = '40000000-0000-4000-8000-000000000001'),
  1::bigint,
  'response-loss replay restores the same operation'
);
select extensions.is(
  (select count(*) from public.bulk_operation_items
   where operation_id = ((select receipt from first_receipt)->>'operationId')::uuid),
  1::bigint,
  'response-loss replay restores the same item'
);

select extensions.throws_ok(
  $$select public.mutate_collection_relation(
    '30000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000001',
    'add',
    '40000000-0000-4000-8000-000000000002'
  )$$,
  'P0001',
  'target_not_owned',
  'a user cannot mutate another user collection'
);
select extensions.throws_ok(
  $$select public.mutate_collection_relation(
    '30000000-0000-4000-8000-000000000099',
    '20000000-0000-4000-8000-000000000001',
    'add',
    '40000000-0000-4000-8000-000000000003'
  )$$,
  'P0001',
  'target_not_owned',
  'a deleted or unknown target is rejected'
);
select extensions.throws_ok(
  $$insert into public.collection_repos (user_id, collection_id, repo_id) values (
    '10000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001'
  )$$,
  '42501',
  null,
  'authenticated direct collection writes are denied'
);

reset role;
reset request.jwt.claim.sub;

select extensions.ok(
  (select effective_relation_version is not null
   from public.bulk_operation_items
   where operation_id = ((select receipt from first_receipt)->>'operationId')::uuid),
  'the item durably stores its original relation version'
);
select extensions.is(
  (select (receipt->>'relationVersion')::bigint from first_receipt),
  (select effective_relation_version
   from public.bulk_operation_items
   where operation_id = ((select receipt from first_receipt)->>'operationId')::uuid),
  'the response and persisted receipt versions agree'
);
select extensions.is(
  (select count(*) from public.collection_relation_heads
   where user_id = '10000000-0000-4000-8000-000000000002'),
  0::bigint,
  'rejected cross-user commands create no relation head'
);
select extensions.is(
  (select count(*) from public.collection_relation_heads
   where collection_id = '30000000-0000-4000-8000-000000000099'),
  0::bigint,
  'invalid targets create no relation head'
);
select extensions.is(
  (select count(*) from public.collection_repos
   where collection_id = '30000000-0000-4000-8000-000000000002'),
  1::bigint,
  'baseline bootstrapping preserves the canonical membership'
);

select extensions.hasnt_function(
  'public',
  'create_collection_dial_undo',
  'create_collection_dial_undo is retired'
);
select extensions.hasnt_function(
  'public',
  'has_unfinished_multi_collection_dial_operation',
  'has_unfinished_multi_collection_dial_operation is retired'
);
select extensions.throws_ok(
  $$select public.create_bulk_operation(
    '10000000-0000-4000-8000-000000000001',
    'manual',
    'collection_dial',
    '40000000-0000-4000-8000-000000000010',
    array['20000000-0000-4000-8000-000000000001'::uuid],
    '[{"relationType":"collection","targetId":"30000000-0000-4000-8000-000000000001","action":"add"}]'::jsonb
  )$$,
  'P0001',
  'invalid_bulk_request',
  'new operations no longer accept collection_dial'
);

select * from extensions.finish();

delete from auth.users
where id in (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002'
);
