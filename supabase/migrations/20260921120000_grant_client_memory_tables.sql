-- 客户端经普通 RLS 直读直写的表必须有表级 GRANT。
-- RLS policy 只约束「通过后能看见哪些行」，不能代替 PostgreSQL 的表权限。
--
-- `memories`（20260917120000）和 `user_repo_embeddings`（20260724120000）
-- 落地时只开了 RLS、没 GRANT。托管项目往往靠默认特权掩盖；本地 / CI 的
-- Supabase 镜像不会自动授权，于是 `memory_foundation` pgTAP 在
-- `set role authenticated` 后对 `memories` 报 permission denied，
-- 自 2026-09-17 起 GitHub CI 一直红。

grant select, insert, update, delete on table public.memories to authenticated;
grant select, insert, update, delete on table public.user_repo_embeddings to authenticated;
