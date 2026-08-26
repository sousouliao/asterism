-- ADR 0036: retire Collection Dial runtime, Undo RPC/columns, and Dial ledger rows.
-- Canonical collection_repos memberships are preserved. collection_relation_heads
-- remain for Quick Look, import, and bulk_dialog execution.

delete from public.bulk_operation_items
where operation_id in (
  select id from public.bulk_operations where interaction = 'collection_dial_undo'
);
delete from public.bulk_operations where interaction = 'collection_dial_undo';

delete from public.bulk_operation_items
where operation_id in (
  select id from public.bulk_operations where interaction = 'collection_dial'
);
delete from public.bulk_operations where interaction = 'collection_dial';

drop function if exists public.create_collection_dial_undo(uuid, uuid, uuid);
drop function if exists public.has_unfinished_multi_collection_dial_operation(uuid);

alter table public.bulk_operations
  drop constraint if exists bulk_operations_undo_shape_check;
drop index if exists public.bulk_operations_undo_of_operation_idx;

alter table public.bulk_operations
  drop column if exists undo_of_operation_id,
  drop column if exists undo_expires_at,
  drop column if exists undo_eligible_count,
  drop column if exists undo_skipped_count,
  drop column if exists undo_conflict_count,
  drop column if exists undo_expired;

alter table public.bulk_operations
  drop constraint if exists bulk_operations_interaction_check;
alter table public.bulk_operations
  add constraint bulk_operations_interaction_check
  check (interaction in ('bulk_dialog'));

drop function if exists public.create_bulk_operation(uuid, text, text, uuid, uuid[], uuid[], jsonb);
drop function if exists public.create_bulk_operation(uuid, text, text, uuid, uuid[], jsonb);

create function public.create_bulk_operation(
  p_user_id uuid,
  p_source text,
  p_interaction text,
  p_client_request_id uuid,
  p_repo_ids uuid[],
  p_changes jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  operation_id uuid;
  normalized_repo_ids uuid[];
  change_count integer;
begin
  if p_source <> 'manual'
    or p_interaction <> 'bulk_dialog'
    or p_client_request_id is null
    or jsonb_typeof(p_changes) <> 'array' then
    raise exception 'invalid_bulk_request';
  end if;

  select array_agg(repo_id order by ordinal)
    into normalized_repo_ids
  from (
    select repo_id, min(ordinal) as ordinal
    from unnest(p_repo_ids) with ordinality as selected(repo_id, ordinal)
    group by repo_id
  ) stable_scope;

  select count(*) into change_count from jsonb_array_elements(p_changes);
  if coalesce(cardinality(normalized_repo_ids), 0) = 0
    or change_count = 0
    or cardinality(normalized_repo_ids) * change_count > 10000 then
    raise exception 'invalid_bulk_request';
  end if;

  if (
    select count(*) from public.user_stars
    where user_id = p_user_id and repo_id = any(normalized_repo_ids)
  ) <> cardinality(normalized_repo_ids) then
    raise exception 'repository_not_owned';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_changes) change
    where change->>'relationType' <> 'collection'
      or change->>'action' not in ('add', 'remove')
      or not exists (
        select 1 from public.collections
        where id = (change->>'targetId')::uuid and user_id = p_user_id
      )
  ) then
    raise exception 'target_not_owned';
  end if;

  insert into public.bulk_operations (
    user_id,
    source,
    interaction,
    client_request_id,
    source_repo_ids
  ) values (
    p_user_id,
    p_source,
    p_interaction,
    p_client_request_id,
    normalized_repo_ids
  )
  on conflict (user_id, client_request_id) do nothing
  returning id into operation_id;

  if operation_id is null then
    select operation.id into operation_id
    from public.bulk_operations operation
    where operation.user_id = p_user_id
      and operation.client_request_id = p_client_request_id
      and operation.source = p_source
      and operation.interaction = p_interaction
      and operation.source_repo_ids = normalized_repo_ids
      and (
        select count(*)
        from public.bulk_operation_items item
        where item.operation_id = operation.id
      ) = cardinality(normalized_repo_ids) * change_count
      and not exists (
        select 1
        from unnest(normalized_repo_ids) repo_id
        cross join jsonb_array_elements(p_changes) change
        where not exists (
          select 1
          from public.bulk_operation_items item
          where item.operation_id = operation.id
            and item.repo_id = repo_id
            and item.relation_type = change->>'relationType'
            and item.target_id = (change->>'targetId')::uuid
            and item.action = change->>'action'
        )
      );

    if operation_id is null then
      raise exception 'client_request_conflict';
    end if;
    return operation_id;
  end if;

  insert into public.bulk_operation_items (
    user_id, operation_id, repo_id, relation_type, target_id, action
  )
  select distinct
    p_user_id,
    operation_id,
    repo_id,
    change->>'relationType',
    (change->>'targetId')::uuid,
    change->>'action'
  from unnest(normalized_repo_ids) repo_id
  cross join jsonb_array_elements(p_changes) change;

  return operation_id;
end;
$$;

revoke all on function public.create_bulk_operation(
  uuid, text, text, uuid, uuid[], jsonb
) from public;
grant execute on function public.create_bulk_operation(
  uuid, text, text, uuid, uuid[], jsonb
) to service_role;

create or replace function public.apply_collection_relation_mutation(
  p_user_id uuid,
  p_collection_id uuid,
  p_repo_id uuid,
  p_action text,
  p_operation_item_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.apply_collection_relation_mutation_unchecked(
    p_user_id,
    p_collection_id,
    p_repo_id,
    p_action,
    p_operation_item_id
  );
end;
$$;
