# 2026-09-22 · GitHub CI 数据库测试失败（github_sync_credentials 权限缺口）

## 现象

GitHub CI 在 push 提交 `feat(sync): add star snapshot reconciliation and history retrieval`（84b15b1）与 `refactor(web): remove topbar sync button and browse library toggle`（83c99ab）后持续失败。
Lint、Typecheck、Vitest 单测均通过；失败挂在 `pnpm test:db` 的 `supabase/tests/star_history.test.sql`。

Run ID：35694696742

```
psql:/home/runner/work/asterism/asterism/supabase/tests/star_history.test.sql:28: ERROR:  permission denied for table github_sync_credentials
HINT:  Grant the required privileges to the current role with: GRANT SELECT ON public.github_sync_credentials TO service_role;
CONTEXT:  SQL expression "exists (
    select 1 from public.github_sync_credentials
    where user_id = p_user_id and last_synced_at > p_checked_at
  )"
PL/pgSQL function public.apply_github_star_snapshot(uuid,jsonb,timestamp with time zone) line 15 at IF
dubious, test returned 3 (wstat 768, 0x300)
Failed 5/5 subtests
```

## 原因

1. **表级权限缺口**：`20260922120000_github_sync_credentials.sql` 在新建表后执行了 `revoke all on public.github_sync_credentials from anon, authenticated;`，但没有显式对 `service_role` 授权。CI 的本地 Postgres 环境中，未被 GRANT 的表对非 owner 角色（包括 `service_role`）默认拒绝。Edge Function（`sync-stars`）直接通过 `admin` 客户端直查与更新该表，同样依赖 `service_role` 权限。
2. **函数执行上下文缺口**：`20260922121500_star_history.sql` 中的 `public.apply_github_star_snapshot` 函数承担事务级跨表（`repos`、`user_stars`、`github_sync_credentials`、`ensure_user_memories`）对账写入职责，但漏标了 `security definer`。在 `set role service_role` 下调用时，函数退化为调用者上下文执行，因而直接触发了 `github_sync_credentials` 权限拒绝。

## 处理

1. 新增迁移 `20260922144000_grant_sync_credentials_and_snapshot_security.sql`：
   - 显式 `grant all on table public.github_sync_credentials to service_role;`。
   - 以 `create or replace function` 将 `apply_github_star_snapshot` 修正为 `security definer`（保持 `set search_path = ''`），并严格锁定仅由 `service_role` 调用。
2. 在 `supabase/tests/star_history.test.sql` 中扩充 pgTAP 测试用例（5 → 7 项）：
   - 增加 `service_role` 对 `github_sync_credentials` 的直接可读性校验。
   - 增加快照对账成功后 `github_sync_credentials.last_synced_at` 时间戳落盘更新断言。
3. 同步修订 `knowledge/contracts/data-model.md` 行级安全章节，记录 `github_sync_credentials` 权限规则。
