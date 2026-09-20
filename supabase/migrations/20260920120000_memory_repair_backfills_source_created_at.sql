-- Memory 修复改为单条幂等语句（GitHub #37 后续修正）。
--
-- 原实现在 Edge Function 里分页 upsert，并用 ignoreDuplicates 保护用户已写入的
-- why_saved / note。副作用是：若用户在 sync 补齐基础 Memory 之前就手工保存过
-- 某仓库的记忆，那条记录的 source_created_at 会永远停在 null——它不是「重复」，
-- 而是一条缺了收藏时间的记录，却被整体跳过。Resurface 依赖该字段判定沉睡，
-- 这些仓库因此永远不会被重新浮现。
--
-- 这里把修复下推到一条 SQL：缺失的 Memory 照常插入；已存在的**仅在**
-- source_created_at 为空时回填，从而既不覆盖用户内容，也不会为已有值的行
-- 触发 updated_at。

create or replace function public.ensure_user_memories(p_user_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  affected bigint;
begin
  -- 携带用户 JWT 调用时只能修复自己；服务端可信上下文（sync-stars 用 service_role，
  -- auth.uid() 为空）可为指定用户修复。execute 权限未授予 anon，匿名无法到达这里。
  if p_user_id is null or (auth.uid() is not null and p_user_id <> auth.uid()) then
    raise exception 'ensure_user_memories may only repair the calling user''s Memories'
      using errcode = '42501';
  end if;

  insert into public.memories (user_id, repo_id, source, source_created_at)
  select us.user_id, us.repo_id, 'github_star', us.starred_at
  from public.user_stars us
  where us.user_id = p_user_id
  on conflict (user_id, repo_id) do update
    set source_created_at = excluded.source_created_at
    where public.memories.source_created_at is null
      and excluded.source_created_at is not null;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.ensure_user_memories(uuid) from public;
revoke all on function public.ensure_user_memories(uuid) from anon;
grant execute on function public.ensure_user_memories(uuid) to authenticated;
grant execute on function public.ensure_user_memories(uuid) to service_role;

-- 一次性回填已经受影响的历史数据。
update public.memories m
set source_created_at = us.starred_at
from public.user_stars us
where us.user_id = m.user_id
  and us.repo_id = m.repo_id
  and m.source_created_at is null
  and us.starred_at is not null;
