-- Memory Foundation: one private Memory per user × repository.

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  repo_id uuid not null references public.repos (id) on delete cascade,
  source text not null default 'github_star' check (source = 'github_star'),
  source_created_at timestamptz,
  why_saved text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, repo_id)
);

create index memories_user_id_idx on public.memories (user_id);
create index memories_repo_id_idx on public.memories (repo_id);

create trigger memories_set_updated_at
  before update on public.memories
  for each row execute function public.set_updated_at();

alter table public.memories enable row level security;

create policy "memories_owner_all" on public.memories
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "notes_owner_all" on public.notes;
drop table public.notes;
