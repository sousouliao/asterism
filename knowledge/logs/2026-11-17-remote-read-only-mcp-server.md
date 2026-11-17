# 2026-11-17 · 只读远程 MCP Server 与 OAuth 2.1（ADR 0050）

为支持外部 MCP 客户端安全访问 Asterism 个人开源记忆，依据审批通过的方案完成 ADR 0050 授权、契约更新、Postgres 只读检索 RPC、Edge Function 共享层重构、远程 MCP Server 以及 Web OAuth 2.1 授权与管理界面。

## 核心改动

1. **数据库层（`20261117120000_mcp_read_rpcs.sql`）**：
   - 在 `extensions` schema 启用 `pg_trgm`，为 `repos.full_name`、`repos.description`（GIN trigram）与 `repos.topics`（GIN）建索引。
   - 新增 6 个 `security invoker`、`set search_path = ''` 的只读 RPC（仅授权 `authenticated`）：`mcp_library_summary`、`mcp_search_repos`、`mcp_get_repo`、`mcp_list_collections`、`mcp_get_collection`、`mcp_related_repos`。
   - 配套 pgTAP 测试 `supabase/tests/mcp_read_rpcs.test.sql` 覆盖用户隔离、`anon` 拒绝、历史仓库开关与语义/元数据回退。
2. **Edge Functions 共享层与 `mcp` 函数**：
   - 抽取 `supabase/functions/_shared/{cors,auth,github-credential}.ts`，收口 `sync-stars`、`read-repo-readme`、`bulk-organize` 的重复逻辑，并让 `read-repo-readme` 在缺省 `providerToken` 时可复用已加密存储的 GitHub 凭据。
   - 新增 `supabase/functions/mcp/`（`mcp-lite` + `zod` + Deno `deno.json` import map），`supabase/config.toml` 配置 `verify_jwt = false`，提供 RFC 9728 `/.well-known/oauth-protected-resource` 元数据、`401 WWW-Authenticate` 挑战，以及 7 个带 `readOnlyHint: true` 的只读工具（`get_library_summary`、`search_stars`、`get_repo`、`list_collections`、`get_collection`、`get_related_repos`、`read_repo_readme`）。
3. **Web 端 OAuth 2.1 与安全回跳**：
   - `packages/db/src/auth.ts` 封装 `supabase.auth.oauth`（详情、批准、拒绝、列表与撤销）。
   - `apps/web/src/auth/redirect.ts` 修复 `RequireAuth` / `RequireAnon` / `LoginPage` 对安全相对路径 `next` 的保留。
   - 新增 `/oauth/consent` 页面（`apps/web/src/pages/oauth-consent.tsx`）与 Settings MCP 分区（`apps/web/src/components/settings-mcp-section.tsx`），补齐 `en` / `zh-CN` 双语文案与单测。

## 本地验证结果

- `pnpm lint`（Biome 378 个文件）：通过。
- `pnpm typecheck`（9 个包任务）：全部通过。
- `pnpm build`（6 个包构建）：全部通过。
- `pnpm test`：
  - `@asterism/core`：17 套件 132 项全部通过。
  - `@asterism/db`：8 套件 59 项全部通过。
  - `@asterism/supabase-functions`：8 套件 70 项全部通过（含 `_shared/auth.test.ts` 与 `mcp/handler.test.ts`）。
  - `@asterism/web`：60 套件中 58 套件（306 项测试，含新增的 `redirect.test.ts`、`oauth-consent.test.tsx`、`settings-mcp-section.test.tsx`）通过；2 项既有测试（`app-topbar.test.tsx` 与 `repo-inspector-context.test.tsx`）在基线提交 `8073c9e` 改版双语文案后即存在断言漂移，与本次改动无关。
- `pnpm test:db`：当前本机无 Docker，未在本地执行；`20261117120000_mcp_read_rpcs.sql` 已通过 `supabase db push` 实际应用到 `hqtrmulypxwdqvzlkhke`。

## 远端上线与 Antigravity 实机验收

- `supabase db push` 成功应用 `20260922144000_grant_sync_credentials_and_snapshot_security.sql` 与 `20261117120000_mcp_read_rpcs.sql`。
- 部署 `mcp --no-verify-jwt`、`sync-stars`、`read-repo-readme`、`bulk-organize`，Vercel Production（`main @ 21616e3`）构建并发布成功。
- 实测 `mcp/.well-known/oauth-protected-resource`、`auth/v1/.well-known/oauth-authorization-server` 与未授权 `401 WWW-Authenticate` 响应正确。
- 通过 `agy mcp add` 在 Antigravity 注册 `asterism` 并完成真实账号 OAuth 2.1 浏览器授权（`/oauth/consent`），端到端验证全部 7 个只读工具：`get_library_summary`（`activeStars: 554`、`historicalStars: 2`、`collectionsCount: 1`）、`list_collections`、`get_collection`（`"Agent 开发"` → `lobehub/streamdown`）、`search_stars`（排行与 `matchReasons`）、`get_repo`（`morluto/rea`）、`get_related_repos`（`metadata_fallback`）以及 `read_repo_readme`（库内仓库截断返回原始 Markdown，非库内仓库 `torvalds/linux` 被拒绝）。
