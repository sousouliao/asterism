# Supabase

Asterism 的数据库 schema 与行级安全（RLS）以迁移文件形式存放于 `migrations/`，是数据层
的单一事实源。本文件说明如何把迁移应用到你的 Supabase 项目，以及 GitHub OAuth 的后台配置。

> 迁移文件不含任何密钥；密钥（Publishable / Secret key）只在本地 `.env` 与 Supabase 后台
> 中配置，**绝不提交**。

## 迁移清单

| 文件 | 作用 |
| --- | --- |
| `20260629120000_initial_schema.sql` | 核心表（`repos` / `user_stars` / `tags` / `repo_tags` / `collections` / `collection_repos` / `notes`）、索引、`updated_at` 触发器，并预启用 `pgvector` 扩展 |
| `20260629120100_row_level_security.sql` | 启用 RLS 并创建策略：`repos` 全局可读，其余表按 `user_id` 隔离 |
| `20260719143000_bulk_organization.sql` | 持久化批量整理：`bulk_operations` / `bulk_operation_items` 表与按 `user_id` 隔离的 RLS（详见 ADR 0023） |
| `20260721120000_ai_provider_connections.sql` | BYOK 生成连接：`ai_provider_connections`（凭据密文，客户端 `revoke all`）与 `user_settings`（owner-only RLS）（详见 ADR 0017 / 0018 / 0024） |
| `20260723120000_ai_organization_drafts.sql` | AI 整理草稿：每用户一个活动草稿、版本化建议、Connection/model provenance，以及仅 service role 可执行的原子替换函数 |
| `20260723160000_ai_organization_review.sql` | AI 草稿人工审阅：把既有草稿升级为 review schema v2，并新增仅 service role 可执行的 revision CAS 更新函数 |
| `20260723190000_ai_organization_confirmation.sql` | AI 草稿确认：安全合并历史等价分类并建立规范化唯一约束、近似名称 guard、以草稿 ID + revision + 完整选择幂等消费确认请求，并在单个受信事务中创建 `source: "ai_draft"` 批量操作与逐关系项目后删除草稿 |
| `20260723193000_fix_ai_organization_confirmation.sql` | AI 草稿确认函数兼容修正：消除真实 Postgres 中 PL/pgSQL 变量与 SQL 标识符的歧义，保持确认事务语义不变 |
| `20260724120000_user_repo_embeddings.sql` | 检索优先地基：`user_repo_embeddings`（384 维向量 + `embedding_model` + `content_hash`，`(user_id, repo_id)` 唯一、级联删除、`set_updated_at` 触发器，与 `notes` 同构），owner-only RLS；规模尚小先不建 ANN 索引（详见 ADR 0026） |
| `20260728180000_organization_tasks.sql` / `20260728183000_localized_organization_opportunity_goal.sql` | 目标优先 Organization Task、无成本同步机会、候选快照、Generation workload 披露 / 批准与 locale 固化 |
| `20260730090000_organization_generation_runs.sql` | 已批准 workload 的可恢复分页 Generation、调用账本、暂停 / 恢复 / 重试和 immutable revisioned Organization Plan |
| `20260804120000_organization_plan_review_execution.sql` | Plan 三档风险审阅、逐 action 排除、服务端 group fingerprint 授权、精确幂等确认与唯一 Organization Task → bulk operation 执行链接 |
| `20260805120000_remove_ai_organization.sql` | 按 ADR 0032 退役 AI 整理：删除 Provider credential、草稿、Task / Plan / Generation 表与 RPC，移除 AI 来源批量账本，同时保留 canonical 标签、集合、关系与 embedding |
| `20260812120000_trusted_collection_relation_mutations.sql` | 按 ADR 0034 建立受信集合关系 mutation seam：基线 relation head、单调 version / effective mutation receipt、bulk interaction / client request 幂等字段，并撤销普通客户端对 `collection_repos` 的直接写权限 |
| `20260814120000_collection_dial_missing_item_scope.sql` | Collection Dial 多选只为冻结范围内真正缺失的 repository ID 创建 items；幂等冲突同时绑定完整范围与缺失子集 |
| `20260814170000_collection_dial_undo.sql` | Collection Dial 30 秒 Undo：首次 effective add receipt 原子写入不可延长的 `undo_expires_at`，并新增仅 service-role 的 `create_collection_dial_undo` RPC |
| `20260818150000_fix_collection_dial_undo_apply.sql` | 修正 `apply_collection_relation_mutation` 中 Undo 收据查找的 PL/pgSQL 变量 / SQL 别名碰撞，使 remove 能真正落到 matching membership |
| `20260819120000_retire_user_tags.sql` | ADR 0035：按规范化名把 Tag 转为或合并进 Collection，幂等写入 `collection_repos` 与 baseline `collection_relation_heads`，然后删除 `tags` / `repo_tags`；新建 bulk operation 只接受 `collection` |
| `20260827000000_retire_collection_dial.sql` | ADR 0036：删除 Collection Dial 账本行、Undo RPC / 列与 item 子集 overload；`create_bulk_operation` 只接受 `bulk_dialog`；`apply_collection_relation_mutation` 直接调用 unchecked。canonical `collection_repos` 与 relation head 保留 |

> 2026-08-05 之前的 AI / Organization migration 是已部署环境必须重放的历史；
> 新环境仍按文件名顺序应用，最终由 `20260805120000_remove_ai_organization.sql` 收敛。
> Collection Dial 相关 migration 同样是历史重放；新环境由
> `20260827000000_retire_collection_dial.sql` 收敛到当前 schema。

> `user_repo_embeddings` 的语义向量属 derived 数据、按用户客户端直写；规模尚小，暂不建 ANN（HNSW / IVFFlat）索引（见 ADR 0026 与 `knowledge/contracts/data-model.md`）。

迁移可重复执行（`if not exists` / `create or replace` / `drop policy if exists`）。

## 应用迁移

### 方式 A：SQL Editor（最简单，无需安装）

1. 打开 Supabase 项目 → 左侧 **SQL Editor**。
2. 按文件名（时间戳前缀即执行顺序）依次把各迁移文件的内容粘贴执行。

### 方式 B：Supabase CLI

```bash
# 1) 安装 CLI：https://supabase.com/docs/guides/cli
# 2) 在仓库根目录初始化（已存在 supabase/migrations 时不会覆盖）
supabase init
# 3) 关联远端项目（project-ref 见 Dashboard URL）
supabase link --project-ref hqtrmulypxwdqvzlkhke
# 4) 推送迁移（会提示输入数据库密码）
supabase db push
```

应用后可在 SQL Editor 运行校验：

```sql
select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename;
```

`repos / user_stars / collections / collection_repos /
collection_relation_heads / notes / bulk_operations / bulk_operation_items /
user_repo_embeddings` 的
`rowsecurity` 应均为 `true`。

> 检索优先向量表 `user_repo_embeddings` 的 owner-only 隔离与 `notes` 同构
> （`user_repo_embeddings_owner_all`：`user_id = auth.uid()` 同时约束 using / with check）。
> 真实环境冒烟：以用户 A 的会话写入一行向量，再以用户 B 的会话对该行 `select` /
> `update` / `delete` 应命中 0 行（跨用户读写被拒）；客户端读写始终按 `user_id` 收窄
> 的回归由 `packages/db` 单测守护。

### 受信集合关系 mutation 冒烟

数据库验收已固化为 pgTAP 集成回归：`pnpm exec supabase start` 后运行 `pnpm test:db`。CI 会自动启动本地 Supabase，覆盖 baseline/no-op、真实并发 add、响应丢失重放、跨用户、非法 target、客户端直写拒绝，以及 Collection Dial RPC / create 已退役。

应用 `20260812120000_trusted_collection_relation_mutations.sql` 并部署最新
`bulk-organize` 后，以两个真实用户会话验证：

1. 用户 A 通过 `mutate_collection_relation` 添加本人 Star 到本人集合；单项 operation / item、
   关系、head 与返回 receipt 同时出现。以同一 client request UUID 重放完全相同命令，应返回
   同一 operation / item 与 receipt；同一 UUID 携带不同范围或 action 应报 `client_request_conflict`。
2. 并发提交两个相同 add；只产生一次有效变更，两个调用最终看到同一 canonical membership，
   head 只推进一个 version。
3. 用户 B 使用 A 的 collection / repository ID 调用 RPC 应被拒绝；A 对已删除 target 调用也应
   被拒绝。authenticated 会话直接对 `collection_repos` 执行 insert / update / delete 应无权限。
4. 对同一 `clientRequestId` 重复创建完全相同的 bulk operation，应返回同一 operation ID；模拟 item 已写入
   collection 但 HTTP 响应丢失后重领，item 应保留原 `effectiveChanged` 与 mutation receipt。
5. 迁移前已有的每条 `collection_repos` membership 都应有 `present = true`、`version = 1`、
   `last_operation_item_id is null` 的基线 head，canonical 行数保持不变。

应用 `20260827000000_retire_collection_dial.sql` 并部署当前 `bulk-organize` 后，Collection Dial
的 create / undo RPC 不再存在。维护者项目 `hqtrmulypxwdqvzlkhke` 已于 2026-08-27 apply
`20260819120000` + `20260827000000`，并把 `bulk-organize` 部署为 ACTIVE v7。

## GitHub OAuth 配置（后台手动一次）

登录流程的客户端代码已在 `apps/web` 接通；登录可用还需在后台完成以下配置：

1. **GitHub** → Settings → Developer settings → **OAuth Apps** → New OAuth App：
   - Homepage URL：你的站点地址（本地可填 `http://localhost:5173`）。
   - **Authorization callback URL**：`https://hqtrmulypxwdqvzlkhke.supabase.co/auth/v1/callback`
   - 创建后拿到 **Client ID** 与 **Client Secret**。
2. **Supabase** → Authentication → **Providers → GitHub**：启用并填入 Client ID / Secret。
3. **Supabase** → Authentication → **URL Configuration**：
   - **Site URL** 填生产站点地址。
   - **Redirect URLs** 增加本地开发地址 `http://localhost:5173`（应与登录时传入的
     `redirectTo = window.location.origin` 一致）。

完成后，在本地 `pnpm --filter @asterism/web dev` 启动，点击「使用 GitHub 登录」即可走通
OAuth 回流并显示当前用户。

## Edge Functions

| 函数 | 作用 |
| --- | --- |
| `sync-stars` | 受信路径（service role）同步用户 GitHub starred 仓库到 `repos` / `user_stars`，支持增量。详见 `functions/sync-stars/README.md` 与 `knowledge/decisions/0006` |
| `bulk-organize` | 受信路径（service role）创建并执行持久化批量 tag / collection 关系变更；按逐关系结果恢复和重试。详见 `functions/bulk-organize/README.md` 与 ADR 0023 |
| `read-repo-readme` | 受保护的 README 读取边界：校验会话与 `user_stars` 成员关系后代理 GitHub REST README HTML，ETag 重验证，token 与内容不落库。详见 `functions/read-repo-readme/README.md` |

```bash
# 部署（需 Supabase CLI 且已 link 项目）
supabase functions deploy sync-stars
supabase functions deploy bulk-organize
supabase functions deploy read-repo-readme
```
