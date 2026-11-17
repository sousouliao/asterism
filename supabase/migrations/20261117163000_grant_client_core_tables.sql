-- 客户端经普通 RLS 与 security invoker RPC 访问的核心表必须显式授予 authenticated 表级权限。
-- 本地 / CI Supabase 镜像不会自动赋予默认特权，缺 GRANT 会导致 `set role authenticated` 后报 permission denied。

grant select on table public.repos to authenticated;
grant select on table public.user_stars to authenticated;
grant select, insert, update, delete on table public.collections to authenticated;
grant select on table public.collection_repos to authenticated;
