# 2026-11-17 · GitHub 流水线排查与核心测试用例精简

## 1. GitHub 流水线（CI）最近情况排查

检查最近 15 次 `CI`（`.github/workflows/ci.yml`）运行记录：

- **最近 4 次运行连续失败**（均在 `@asterism/web#test` 阶段退出，导致后续 `Start local Supabase`、`Database integration tests` 与 `Build` 未执行）：
  - `44039178610`（2026-11-17，`docs(knowledge): record remote mcp oauth acceptance`）
  - `44037348888`（2026-11-17，`feat(mcp): add read-only remote mcp server and oauth 2.1 flow`）
  - `38035633696`（2026-10-10，`refactor(memory): retire resurface recommendations`）
  - `37894618665`（2026-10-09，`fix(web): clarify bilingual interface copy`）
- **根因**：`8073c9e`（双语文案改版）更新了 `en.json`，但有两处强耦合旧文案的 Web 单测未同步：
  1. `apps/web/src/components/app-topbar.test.tsx`：断言 `'Search by meaning'`，实际文案已改为 `'Semantic search'`。
  2. `apps/web/src/contexts/repo-inspector-context.test.tsx`：按 `'Why I saved this'` 查找文本框，实际文案已改为 `'Why saved'`，导致 `textarea` 为 `null` 抛出 `TypeError`。
- **更早一次失败**：`35694696742`（2026-09-22）曾因 Docker Hub `toomanyrequests` 限流与 `github_sync_credentials` 权限问题失败，随后在 `35696202811` 已修复并连续通过 10 次至 `36621368186`。

## 2. 测试用例精简（只保留核心必须用例）

按「保留安全边界、数据库契约、领域核心逻辑与关键状态机；移除纯样式类名、几何布局、动效、文案强耦合组件及 trivial 工具函数测试」原则完成精简：

- **保留的核心测试（61 个测试文件）**：
  - `supabase/tests/*.test.sql`（6 个 pgTAP SQL 测试）：RLS 隔离、表 GRANT、Memory 修复、Star 快照历史、集合变更安全、MCP 只读 RPC。
  - `supabase/functions/**/*.test.ts`（8 套件 70 项）：Auth/CORS、BYOK 代理与防泄漏（`ask-generate`）、MCP OAuth/只读工具、`read-repo-readme` 鉴权与 ETag、`bulk-organize` 幂等/所有权、`sync-stars` Memory 修复。
  - `packages/core`（15 套件 129 项）：GitHub 分页、筛选排序、混合/统一检索、语义近邻、Ask Agent 工具/循环/SSE/哨兵解析、速读 Prompt 与脱敏、JSON v3 导出、Embedding 增量哈希与分片。
  - `packages/db`（7 套件 57 项）：`ask`、`bulk-operations`、`collection-repos`、`embeddings`、`memories`、`repos`、`readme` 的边界校验与分页。
  - `apps/web`（25 套件 117 项）：Auth 会话与防开放重定向、i18n 契约校验（`locales` 中英文留白与键对齐、`language-preference`）、BYOK 密钥安全与生命周期（`ai-connections`、`ask-byok`、`use-ai-connections`）、`use-ask-question`、Embedding 隐私门禁与 Worker 恢复、README XSS 清洗与查询安全、JSON 导出快照、OAuth 2.1 授权与 MCP 撤销（`oauth-consent`、`settings-mcp-section`）、以及修复并单语言精简后的 Memory 未保存草稿拦截（`repo-inspector-context.test.tsx`）。
- **移除的非核心测试（38 个文件）**：
  - `packages/core`（2）：`models/repo.test.ts`、`classifications/name.test.ts`。
  - `packages/db`（1）：`client.test.ts`。
  - `apps/web`（35）：`app-topbar`、`ask-panel`、`repo-card`、`repo-table`、`repo-filter-bar`、`repo-context-chip`、`repo-inspector-overlay`、`memory-section`、`match-explanation-badge`、`overflow-chip-row`、`facet-options`、`repo-card-context`、`truncated-description`、`trigger-active-states`、`ai-connection-form-dialog`、`ai-connections-manager`、`settings-ask-section`、`use-readme-return-restore`、`format`、`readme-corpus`、`readme-navigation`、`readme-outline`、`readme-return-coordinator`、`readme-workspace-motion*`、`repo-card-metadata`、`repo-digest-storage`、`ui-cn`、`repo-readme`、`settings`、`stores/*`、`theme-*`。

## 3. 补齐核心表 `authenticated` 表级 GRANT（修复 CI `test:db`）

- 精简测试并修复 Web 断言后，CI 首次推进到 `Database integration tests`（`44046725883`），暴露 `mcp_read_rpcs.test.sql` 在 `set local role authenticated` 后调用 `security invoker` RPC `mcp_library_summary()` 时报 `permission denied for table user_stars`。
- 根因与此前 `memories` / `user_repo_embeddings` 一致：`repos`、`user_stars`、`collections`、`collection_repos` 在初始迁移只设了 RLS policy 而缺少表级 `GRANT`，本地 / CI Supabase 镜像不会自动授默认特权。
- 新增 `supabase/migrations/20261117163000_grant_client_core_tables.sql`，显式为 `authenticated` 授予 `repos`（SELECT）、`user_stars`（SELECT）、`collections`（SELECT/INSERT/UPDATE/DELETE）与 `collection_repos`（SELECT）。

## 4. 本地验证

- `pnpm lint`（Biome 检查 340 个文件）：通过。
- `pnpm typecheck`（9 个包任务）：全部通过。
- `pnpm turbo run test --force`（55 个 Vitest 套件共 373 项测试）：全部通过（`@asterism/supabase-functions` 70 项、`@asterism/core` 129 项、`@asterism/db` 57 项、`@asterism/web` 117 项）。
- `pnpm build`（6 个包构建）：全部通过。
- `pnpm test:db`：本机无 Docker，需推送后由 GitHub Actions 本地 Supabase job 验证。
