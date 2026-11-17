-- ADR 0050: Read-only MCP server query indexes and security-invoker RPCs.
-- All RPCs run under the caller's authenticated JWT (RLS enforced) and are
-- never granted to anon or public.

create extension if not exists pg_trgm with schema extensions;

create index if not exists repos_full_name_trgm_idx
  on public.repos using gin (full_name extensions.gin_trgm_ops);

create index if not exists repos_description_trgm_idx
  on public.repos using gin (description extensions.gin_trgm_ops);

create index if not exists repos_topics_gin_idx
  on public.repos using gin (topics);

-- ---------------------------------------------------------------------------
-- 1. mcp_library_summary
-- ---------------------------------------------------------------------------
create or replace function public.mcp_library_summary()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_active_stars bigint := 0;
  v_historical_stars bigint := 0;
  v_annotated_memories bigint := 0;
  v_collections_count bigint := 0;
  v_top_languages jsonb := '[]'::jsonb;
  v_top_topics jsonb := '[]'::jsonb;
  v_collections jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    return jsonb_build_object(
      'activeStars', 0,
      'historicalStars', 0,
      'annotatedMemories', 0,
      'collectionsCount', 0,
      'topLanguages', '[]'::jsonb,
      'topTopics', '[]'::jsonb,
      'collections', '[]'::jsonb
    );
  end if;

  select
    count(*) filter (where us.unstarred_at is null),
    count(*) filter (where us.unstarred_at is not null)
  into v_active_stars, v_historical_stars
  from public.user_stars us
  where us.user_id = v_user_id;

  select count(*)
  into v_annotated_memories
  from public.memories m
  where m.user_id = v_user_id
    and (
      nullif(btrim(coalesce(m.why_saved, '')), '') is not null
      or nullif(btrim(coalesce(m.note, '')), '') is not null
    );

  select count(*)
  into v_collections_count
  from public.collections c
  where c.user_id = v_user_id;

  select coalesce(
    jsonb_agg(jsonb_build_object('language', lang_stats.language, 'count', lang_stats.repo_count) order by lang_stats.repo_count desc, lang_stats.language asc),
    '[]'::jsonb
  )
  into v_top_languages
  from (
    select r.language, count(*)::integer as repo_count
    from public.user_stars us
    join public.repos r on r.id = us.repo_id
    where us.user_id = v_user_id
      and us.unstarred_at is null
      and r.language is not null
      and btrim(r.language) <> ''
    group by r.language
    order by repo_count desc, r.language asc
    limit 15
  ) lang_stats;

  select coalesce(
    jsonb_agg(jsonb_build_object('topic', topic_stats.topic, 'count', topic_stats.repo_count) order by topic_stats.repo_count desc, topic_stats.topic asc),
    '[]'::jsonb
  )
  into v_top_topics
  from (
    select t.topic, count(*)::integer as repo_count
    from public.user_stars us
    join public.repos r on r.id = us.repo_id
    cross join lateral unnest(r.topics) as t(topic)
    where us.user_id = v_user_id
      and us.unstarred_at is null
    group by t.topic
    order by repo_count desc, t.topic asc
    limit 20
  ) topic_stats;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', c_stats.id,
        'name', c_stats.name,
        'description', c_stats.description,
        'repoCount', c_stats.repo_count
      )
      order by c_stats.repo_count desc, c_stats.name asc
    ),
    '[]'::jsonb
  )
  into v_collections
  from (
    select
      c.id,
      c.name,
      c.description,
      count(cr.repo_id)::integer as repo_count
    from public.collections c
    left join public.collection_repos cr
      on cr.collection_id = c.id and cr.user_id = v_user_id
    where c.user_id = v_user_id
    group by c.id, c.name, c.description
    order by repo_count desc, c.name asc
    limit 50
  ) c_stats;

  return jsonb_build_object(
    'activeStars', v_active_stars,
    'historicalStars', v_historical_stars,
    'annotatedMemories', v_annotated_memories,
    'collectionsCount', v_collections_count,
    'topLanguages', v_top_languages,
    'topTopics', v_top_topics,
    'collections', v_collections
  );
end;
$$;

revoke all on function public.mcp_library_summary() from public;
grant execute on function public.mcp_library_summary() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. mcp_search_repos
-- ---------------------------------------------------------------------------
create or replace function public.mcp_search_repos(
  p_query text default null,
  p_language text default null,
  p_topic text default null,
  p_collection_id uuid default null,
  p_include_archived boolean default true,
  p_include_history boolean default false,
  p_sort text default 'starred',
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_query text := nullif(btrim(coalesce(p_query, '')), '');
  v_pattern text := null;
  v_language text := nullif(btrim(coalesce(p_language, '')), '');
  v_topic text := nullif(btrim(coalesce(p_topic, '')), '');
  v_sort text := coalesce(nullif(btrim(coalesce(p_sort, '')), ''), 'starred');
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_total bigint := 0;
  v_items jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    return jsonb_build_object('total', 0, 'hasMore', false, 'items', '[]'::jsonb);
  end if;

  if v_query is not null then
    v_pattern := '%' || replace(replace(replace(v_query, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  with filtered as (
    select
      r.id as repo_id,
      r.github_id,
      r.full_name,
      r.name,
      r.owner,
      r.description,
      r.language,
      r.topics,
      r.stargazers,
      r.forks,
      r.homepage,
      r.pushed_at,
      r.repo_created_at,
      r.archived,
      r.is_fork,
      us.starred_at,
      us.unstarred_at,
      m.why_saved,
      m.note,
      (
        case when v_pattern is not null and coalesce(m.why_saved, '') ilike v_pattern escape '\' then 8 else 0 end +
        case when v_pattern is not null and coalesce(m.note, '') ilike v_pattern escape '\' then 6 else 0 end +
        case when v_pattern is not null and r.full_name ilike v_pattern escape '\' then 5 else 0 end +
        case when v_pattern is not null and exists (
          select 1 from unnest(r.topics) as t(topic) where t.topic ilike v_pattern escape '\'
        ) then 3 else 0 end +
        case when v_pattern is not null and coalesce(r.description, '') ilike v_pattern escape '\' then 2 else 0 end
      ) as relevance_score,
      array_remove(array[
        case when v_pattern is not null and coalesce(m.why_saved, '') ilike v_pattern escape '\' then 'why_saved' end,
        case when v_pattern is not null and coalesce(m.note, '') ilike v_pattern escape '\' then 'note' end,
        case when v_pattern is not null and r.full_name ilike v_pattern escape '\' then 'name' end,
        case when v_pattern is not null and exists (
          select 1 from unnest(r.topics) as t(topic) where t.topic ilike v_pattern escape '\'
        ) then 'topic' end,
        case when v_pattern is not null and coalesce(r.description, '') ilike v_pattern escape '\' then 'description' end
      ], null) as match_reasons
    from public.user_stars us
    join public.repos r on r.id = us.repo_id
    left join public.memories m on m.user_id = v_user_id and m.repo_id = r.id
    where us.user_id = v_user_id
      and (coalesce(p_include_history, false) or us.unstarred_at is null)
      and (coalesce(p_include_archived, true) or not r.archived)
      and (v_language is null or lower(coalesce(r.language, '')) = lower(v_language))
      and (
        v_topic is null
        or exists (
          select 1 from unnest(r.topics) as t(topic) where lower(t.topic) = lower(v_topic)
        )
      )
      and (
        p_collection_id is null
        or exists (
          select 1
          from public.collection_repos cr
          where cr.user_id = v_user_id
            and cr.collection_id = p_collection_id
            and cr.repo_id = r.id
        )
      )
      and (
        v_pattern is null
        or r.full_name ilike v_pattern escape '\'
        or coalesce(r.description, '') ilike v_pattern escape '\'
        or exists (
          select 1 from unnest(r.topics) as t(topic) where t.topic ilike v_pattern escape '\'
        )
        or coalesce(m.why_saved, '') ilike v_pattern escape '\'
        or coalesce(m.note, '') ilike v_pattern escape '\'
      )
  ),
  counted as (
    select count(*) as total_count from filtered
  ),
  paged as (
    select
      f.*,
      row_number() over (
        order by
          case when v_sort = 'relevance' then f.relevance_score end desc nulls last,
          case when v_sort = 'stars' then f.stargazers end desc nulls last,
          case when v_sort = 'pushed' then f.pushed_at end desc nulls last,
          case when v_sort = 'name' then lower(f.full_name) end asc nulls last,
          case when v_sort in ('starred', 'relevance') then f.starred_at end desc nulls last,
          f.starred_at desc nulls last,
          f.repo_id asc
      ) as sort_ord,
      coalesce(
        (
          select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.name asc)
          from public.collection_repos cr
          join public.collections c on c.id = cr.collection_id
          where cr.user_id = v_user_id
            and c.user_id = v_user_id
            and cr.repo_id = f.repo_id
        ),
        '[]'::jsonb
      ) as collections
    from filtered f
    order by
      case when v_sort = 'relevance' then f.relevance_score end desc nulls last,
      case when v_sort = 'stars' then f.stargazers end desc nulls last,
      case when v_sort = 'pushed' then f.pushed_at end desc nulls last,
      case when v_sort = 'name' then lower(f.full_name) end asc nulls last,
      case when v_sort in ('starred', 'relevance') then f.starred_at end desc nulls last,
      f.starred_at desc nulls last,
      f.repo_id asc
    limit v_limit
    offset v_offset
  )
  select
    (select total_count from counted),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'repoId', p.repo_id,
          'githubId', p.github_id,
          'fullName', p.full_name,
          'name', p.name,
          'owner', p.owner,
          'description', p.description,
          'language', p.language,
          'topics', to_jsonb(p.topics),
          'stargazers', p.stargazers,
          'forks', p.forks,
          'homepage', p.homepage,
          'pushedAt', p.pushed_at,
          'repoCreatedAt', p.repo_created_at,
          'archived', p.archived,
          'isFork', p.is_fork,
          'starredAt', p.starred_at,
          'unstarredAt', p.unstarred_at,
          'whySaved', p.why_saved,
          'note', p.note,
          'collections', p.collections,
          'matchReasons', to_jsonb(p.match_reasons)
        )
        order by p.sort_ord asc
      ),
      '[]'::jsonb
    )
  into v_total, v_items
  from paged p;

  return jsonb_build_object(
    'total', v_total,
    'hasMore', (v_offset + jsonb_array_length(v_items)) < v_total,
    'items', v_items
  );
end;
$$;

revoke all on function public.mcp_search_repos(text, text, text, uuid, boolean, boolean, text, integer, integer) from public;
grant execute on function public.mcp_search_repos(text, text, text, uuid, boolean, boolean, text, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. mcp_get_repo
-- ---------------------------------------------------------------------------
create or replace function public.mcp_get_repo(
  p_repo_id uuid default null,
  p_full_name text default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_full_name text := nullif(btrim(coalesce(p_full_name, '')), '');
  v_result jsonb;
begin
  if v_user_id is null or (p_repo_id is null and v_full_name is null) then
    return null;
  end if;

  select jsonb_build_object(
    'repoId', r.id,
    'githubId', r.github_id,
    'fullName', r.full_name,
    'name', r.name,
    'owner', r.owner,
    'description', r.description,
    'language', r.language,
    'topics', to_jsonb(r.topics),
    'stargazers', r.stargazers,
    'forks', r.forks,
    'homepage', r.homepage,
    'pushedAt', r.pushed_at,
    'repoCreatedAt', r.repo_created_at,
    'archived', r.archived,
    'isFork', r.is_fork,
    'syncedAt', r.synced_at,
    'starredAt', us.starred_at,
    'unstarredAt', us.unstarred_at,
    'whySaved', m.why_saved,
    'note', m.note,
    'collections', coalesce(
      (
        select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.name asc)
        from public.collection_repos cr
        join public.collections c on c.id = cr.collection_id
        where cr.user_id = v_user_id
          and c.user_id = v_user_id
          and cr.repo_id = r.id
      ),
      '[]'::jsonb
    )
  )
  into v_result
  from public.user_stars us
  join public.repos r on r.id = us.repo_id
  left join public.memories m on m.user_id = v_user_id and m.repo_id = r.id
  where us.user_id = v_user_id
    and (
      (p_repo_id is not null and r.id = p_repo_id)
      or (p_repo_id is null and lower(r.full_name) = lower(v_full_name))
    )
  limit 1;

  return v_result;
end;
$$;

revoke all on function public.mcp_get_repo(uuid, text) from public;
grant execute on function public.mcp_get_repo(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. mcp_list_collections
-- ---------------------------------------------------------------------------
create or replace function public.mcp_list_collections()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', row_data.id,
        'name', row_data.name,
        'description', row_data.description,
        'repoCount', row_data.repo_count,
        'updatedAt', row_data.updated_at
      )
      order by row_data.updated_at desc, row_data.name asc
    ),
    '[]'::jsonb
  )
  from (
    select
      c.id,
      c.name,
      c.description,
      c.updated_at,
      count(cr.repo_id)::integer as repo_count
    from public.collections c
    left join public.collection_repos cr
      on cr.collection_id = c.id and cr.user_id = (select auth.uid())
    where c.user_id = (select auth.uid())
    group by c.id, c.name, c.description, c.updated_at
  ) row_data;
$$;

revoke all on function public.mcp_list_collections() from public;
grant execute on function public.mcp_list_collections() to authenticated;

-- ---------------------------------------------------------------------------
-- 5. mcp_get_collection
-- ---------------------------------------------------------------------------
create or replace function public.mcp_get_collection(
  p_collection_id uuid default null,
  p_name text default null,
  p_limit integer default 30,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 50);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_collection record;
  v_total bigint := 0;
  v_items jsonb := '[]'::jsonb;
begin
  if v_user_id is null or (p_collection_id is null and v_name is null) then
    return null;
  end if;

  select c.id, c.name, c.description, c.created_at, c.updated_at
  into v_collection
  from public.collections c
  where c.user_id = v_user_id
    and (
      (p_collection_id is not null and c.id = p_collection_id)
      or (p_collection_id is null and lower(c.name) = lower(v_name))
    )
  limit 1;

  if v_collection.id is null then
    return null;
  end if;

  select count(*)
  into v_total
  from public.collection_repos cr
  where cr.user_id = v_user_id
    and cr.collection_id = v_collection.id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'repoId', paged.repo_id,
        'fullName', paged.full_name,
        'description', paged.description,
        'language', paged.language,
        'topics', to_jsonb(paged.topics),
        'stargazers', paged.stargazers,
        'archived', paged.archived,
        'starredAt', paged.starred_at,
        'unstarredAt', paged.unstarred_at,
        'whySaved', paged.why_saved,
        'note', paged.note
      )
      order by paged.sort_ord asc
    ),
    '[]'::jsonb
  )
  into v_items
  from (
    select
      r.id as repo_id,
      r.full_name,
      r.description,
      r.language,
      r.topics,
      r.stargazers,
      r.archived,
      us.starred_at,
      us.unstarred_at,
      m.why_saved,
      m.note,
      row_number() over (order by cr.position asc nulls last, cr.created_at desc, r.id asc) as sort_ord
    from public.collection_repos cr
    join public.repos r on r.id = cr.repo_id
    left join public.user_stars us on us.user_id = v_user_id and us.repo_id = r.id
    left join public.memories m on m.user_id = v_user_id and m.repo_id = r.id
    where cr.user_id = v_user_id
      and cr.collection_id = v_collection.id
    order by cr.position asc nulls last, cr.created_at desc, r.id asc
    limit v_limit
    offset v_offset
  ) paged;

  return jsonb_build_object(
    'id', v_collection.id,
    'name', v_collection.name,
    'description', v_collection.description,
    'createdAt', v_collection.created_at,
    'updatedAt', v_collection.updated_at,
    'total', v_total,
    'hasMore', (v_offset + jsonb_array_length(v_items)) < v_total,
    'items', v_items
  );
end;
$$;

revoke all on function public.mcp_get_collection(uuid, text, integer, integer) from public;
grant execute on function public.mcp_get_collection(uuid, text, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. mcp_related_repos
-- ---------------------------------------------------------------------------
create or replace function public.mcp_related_repos(
  p_repo_id uuid default null,
  p_full_name text default null,
  p_limit integer default 5
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_full_name text := nullif(btrim(coalesce(p_full_name, '')), '');
  v_limit integer := least(greatest(coalesce(p_limit, 5), 1), 12);
  v_anchor record;
  v_anchor_embedding extensions.vector(384);
  v_items jsonb := '[]'::jsonb;
begin
  if v_user_id is null or (p_repo_id is null and v_full_name is null) then
    return null;
  end if;

  select r.id, r.full_name, r.language, r.topics
  into v_anchor
  from public.user_stars us
  join public.repos r on r.id = us.repo_id
  where us.user_id = v_user_id
    and (
      (p_repo_id is not null and r.id = p_repo_id)
      or (p_repo_id is null and lower(r.full_name) = lower(v_full_name))
    )
  limit 1;

  if v_anchor.id is null then
    return null;
  end if;

  select e.embedding
  into v_anchor_embedding
  from public.user_repo_embeddings e
  where e.user_id = v_user_id
    and e.repo_id = v_anchor.id
  limit 1;

  if v_anchor_embedding is not null then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'repoId', n.repo_id,
          'fullName', n.full_name,
          'description', n.description,
          'language', n.language,
          'topics', to_jsonb(n.topics),
          'stargazers', n.stargazers,
          'whySaved', n.why_saved,
          'similarity', round((1.0 - n.distance)::numeric, 4)
        )
        order by n.distance asc, n.repo_id asc
      ),
      '[]'::jsonb
    )
    into v_items
    from (
      select
        r.id as repo_id,
        r.full_name,
        r.description,
        r.language,
        r.topics,
        r.stargazers,
        m.why_saved,
        (e.embedding OPERATOR(extensions.<=>) v_anchor_embedding) as distance
      from public.user_repo_embeddings e
      join public.user_stars us on us.user_id = v_user_id and us.repo_id = e.repo_id
      join public.repos r on r.id = e.repo_id
      left join public.memories m on m.user_id = v_user_id and m.repo_id = r.id
      where e.user_id = v_user_id
        and e.repo_id <> v_anchor.id
      order by distance asc, r.id asc
      limit v_limit
    ) n;

    return jsonb_build_object(
      'anchorRepoId', v_anchor.id,
      'anchorFullName', v_anchor.full_name,
      'mode', 'semantic',
      'items', v_items
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'repoId', ranked.repo_id,
        'fullName', ranked.full_name,
        'description', ranked.description,
        'language', ranked.language,
        'topics', to_jsonb(ranked.topics),
        'stargazers', ranked.stargazers,
        'whySaved', ranked.why_saved,
        'sharedTopics', to_jsonb(ranked.shared_topics),
        'sameLanguage', ranked.same_language,
        'sharedCollectionsCount', ranked.shared_collections_count
      )
      order by ranked.overlap_score desc, ranked.stargazers desc, ranked.repo_id asc
    ),
    '[]'::jsonb
  )
  into v_items
  from (
    select
      c.*,
      (
        cardinality(c.shared_topics) * 3
        + c.shared_collections_count * 2
        + case when c.same_language then 1 else 0 end
      ) as overlap_score
    from (
      select
        r.id as repo_id,
        r.full_name,
        r.description,
        r.language,
        r.topics,
        r.stargazers,
        m.why_saved,
        coalesce(
          array(
            select t
            from unnest(r.topics) as t
            where t = any(v_anchor.topics)
            order by t asc
          ),
          '{}'::text[]
        ) as shared_topics,
        (v_anchor.language is not null and r.language = v_anchor.language) as same_language,
        (
          select count(*)::integer
          from public.collection_repos cr1
          join public.collection_repos cr2
            on cr2.collection_id = cr1.collection_id
           and cr2.user_id = v_user_id
          where cr1.user_id = v_user_id
            and cr1.repo_id = v_anchor.id
            and cr2.repo_id = r.id
        ) as shared_collections_count
      from public.user_stars us
      join public.repos r on r.id = us.repo_id
      left join public.memories m on m.user_id = v_user_id and m.repo_id = r.id
      where us.user_id = v_user_id
        and r.id <> v_anchor.id
    ) c
    where cardinality(c.shared_topics) > 0
       or c.shared_collections_count > 0
       or c.same_language
    order by overlap_score desc, c.stargazers desc, c.repo_id asc
    limit v_limit
  ) ranked;

  return jsonb_build_object(
    'anchorRepoId', v_anchor.id,
    'anchorFullName', v_anchor.full_name,
    'mode', 'metadata_fallback',
    'items', v_items
  );
end;
$$;

revoke all on function public.mcp_related_repos(uuid, text, integer) from public;
grant execute on function public.mcp_related_repos(uuid, text, integer) to authenticated;
