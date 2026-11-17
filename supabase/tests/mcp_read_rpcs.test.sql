create extension if not exists pgtap with schema extensions;

begin;
select extensions.plan(13);

insert into auth.users (id, email)
values
  ('10000000-0000-4000-8000-000000000061', 'mcp-a@example.test'),
  ('10000000-0000-4000-8000-000000000062', 'mcp-b@example.test');

insert into public.repos (id, github_id, full_name, name, owner, description, language, topics, stargazers)
values
  (
    '20000000-0000-4000-8000-000000000061',
    300000661,
    'acme/vector-db',
    'vector-db',
    'acme',
    'Fast embedded search',
    'Rust',
    array['search', 'rust'],
    5200
  ),
  (
    '20000000-0000-4000-8000-000000000062',
    300000662,
    'acme/text-index',
    'text-index',
    'acme',
    'Full-text engine',
    'Rust',
    array['search', 'bm25'],
    1800
  ),
  (
    '20000000-0000-4000-8000-000000000063',
    300000663,
    'acme/old-tool',
    'old-tool',
    'acme',
    'Legacy CLI',
    'Go',
    array['cli'],
    900
  ),
  (
    '20000000-0000-4000-8000-000000000064',
    300000664,
    'other/secret-star',
    'secret-star',
    'other',
    'Only user B starred this',
    'TypeScript',
    array['private'],
    42
  );

insert into public.user_stars (user_id, repo_id, starred_at, unstarred_at)
values
  ('10000000-0000-4000-8000-000000000061', '20000000-0000-4000-8000-000000000061', '2026-09-01T00:00:00Z', null),
  ('10000000-0000-4000-8000-000000000061', '20000000-0000-4000-8000-000000000062', '2026-09-02T00:00:00Z', null),
  ('10000000-0000-4000-8000-000000000061', '20000000-0000-4000-8000-000000000063', '2026-08-01T00:00:00Z', '2026-09-10T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000062', '20000000-0000-4000-8000-000000000064', '2026-09-05T00:00:00Z', null);

insert into public.memories (user_id, repo_id, source, why_saved, note)
values
  (
    '10000000-0000-4000-8000-000000000061',
    '20000000-0000-4000-8000-000000000061',
    'github_star',
    'Hybrid retrieval benchmark candidate',
    'Compare against tantivy'
  ),
  (
    '10000000-0000-4000-8000-000000000062',
    '20000000-0000-4000-8000-000000000064',
    'github_star',
    'User B private memory',
    null
  );

insert into public.collections (id, user_id, name, description)
values
  ('30000000-0000-4000-8000-000000000061', '10000000-0000-4000-8000-000000000061', 'Retrieval', 'Search & indexing tools'),
  ('30000000-0000-4000-8000-000000000062', '10000000-0000-4000-8000-000000000062', 'User B Collection', null);

insert into public.collection_repos (user_id, collection_id, repo_id)
values
  ('10000000-0000-4000-8000-000000000061', '30000000-0000-4000-8000-000000000061', '20000000-0000-4000-8000-000000000061'),
  ('10000000-0000-4000-8000-000000000062', '30000000-0000-4000-8000-000000000062', '20000000-0000-4000-8000-000000000064');

set local role anon;
select extensions.throws_ok(
  $$select public.mcp_library_summary()$$,
  '42501',
  null,
  'anon cannot execute mcp_library_summary'
);
reset role;

set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000061';
set local role authenticated;

select extensions.is(
  (public.mcp_library_summary()->>'activeStars')::integer,
  2,
  'summary counts active stars for caller only'
);
select extensions.is(
  (public.mcp_library_summary()->>'historicalStars')::integer,
  1,
  'summary counts historical unstarred repos'
);
select extensions.is(
  (public.mcp_search_repos(p_query => 'tantivy')->>'total')::integer,
  1,
  'search matches personal memory note'
);
select extensions.is(
  (public.mcp_search_repos(p_query => 'tantivy')->'items'->0->'matchReasons')::jsonb,
  '["note"]'::jsonb,
  'search reports note as match reason'
);
select extensions.is(
  (public.mcp_search_repos(p_include_history => false)->>'total')::integer,
  2,
  'search excludes unstarred history by default'
);
select extensions.is(
  (public.mcp_search_repos(p_include_history => true)->>'total')::integer,
  3,
  'search includes history when requested'
);
select extensions.is(
  public.mcp_get_repo(p_full_name => 'other/secret-star'),
  null,
  'get_repo returns null for repos outside caller library'
);
select extensions.is(
  (public.mcp_get_repo(p_full_name => 'ACME/vector-db')->>'whySaved'),
  'Hybrid retrieval benchmark candidate',
  'get_repo resolves full_name case-insensitively with memory'
);
select extensions.is(
  jsonb_array_length(public.mcp_list_collections()),
  1,
  'list_collections only returns caller collections'
);
select extensions.is(
  (public.mcp_get_collection(p_name => 'retrieval')->>'total')::integer,
  1,
  'get_collection resolves by name case-insensitively'
);
select extensions.is(
  (public.mcp_related_repos(p_full_name => 'acme/vector-db')->>'mode'),
  'metadata_fallback',
  'related_repos falls back to metadata overlap when embeddings are absent'
);

insert into public.user_repo_embeddings (user_id, repo_id, embedding, embedding_model, content_hash)
values
  (
    '10000000-0000-4000-8000-000000000061',
    '20000000-0000-4000-8000-000000000061',
    array_fill(0.1::real, array[384])::extensions.vector(384),
    'multilingual-e5-small',
    'hash-1'
  ),
  (
    '10000000-0000-4000-8000-000000000061',
    '20000000-0000-4000-8000-000000000062',
    array_fill(0.2::real, array[384])::extensions.vector(384),
    'multilingual-e5-small',
    'hash-2'
  );

select extensions.is(
  (public.mcp_related_repos(p_full_name => 'acme/vector-db')->>'mode'),
  'semantic',
  'related_repos uses semantic mode when user embeddings exist'
);

select * from extensions.finish();
rollback;
