# ADR 0050 · 只读远程 MCP Server（Supabase Edge Functions + OAuth 2.1）

- Status: Accepted
- Date: 2026-11-17
- Updates: `contracts/product.md`、`contracts/architecture.md`、`contracts/data-model.md`、`contracts/ui-ux.md`、`roadmap.md`、`runbooks/self-host.md`
- Preserves: ADR 0037（个人记忆边界）、ADR 0045（Ask 客户端目录常驻 Agent 不变）、ADR 0047（Star 历史与加密同步凭据边界）

## Context

`proposals/asterism-transformation-roadmap.md` Phase 6 提出在不打开 Asterism Web UI 的情况下，让外部开发工具安全查询个人开源记忆。同时 Ask Asterism（ADR 0045）已验证 `filter` / `search` / `expand` 与防幻觉边界，个人库与同步凭据已全部运行在 Supabase Postgres 与 Edge Functions 之上。

如果把 MCP 做成本地 `stdio` CLI，每次接入新客户端都需独立配置 Node 环境与凭据；而在服务端用静态 PAT 会绕开标准 MCP 鉴权发现并增加长期密钥泄露风险。Supabase 已同时具备 Edge Functions（Streamable HTTP）与 Supabase Auth OAuth 2.1 Server，可以将标准 OAuth 2.1 授权与现有 PostgreSQL RLS 身份隔离结合在一起。

## Trade-offs

- **只读 vs 读写**：首版严格限定为只读工具。允许外部 Agent 直接写 `memories` / `collections` 或 GitHub Star，会突破人类确认边界（见 `contracts/product.md`）并引入误改风险；只读已足以覆盖编码与调研阶段的检回需求。
- **服务端 SQL 检索 vs 复用浏览器内存全量计算**：浏览器端 `packages/core` 的检索与 Ask 工具先拉全量数据再到客户端计算；在 Edge Function 每次请求拉全库既慢又受内存限制。将搜索下沉为 `security invoker` Postgres RPC，既复用 RLS 隔离，又避免服务端 `service_role` 越权路径。
- **Query Embedding 边界**：`user_repo_embeddings` 由浏览器内 `multilingual-e5-small` 生成，Deno Edge Function 不在请求路径运行本地推理模型。因此远程 `search_stars` 使用 Postgres 词法 / trigram / GIN 检索；`get_related_repos` 在锚点仓库已有存储向量时直接利用 `user_repo_embeddings` 的 `extensions.<=>` 余弦距离排序，无向量时退回 `topics` / 语言 / Collection 重合度。
- **OAuth 2.1 Scope 粒度**：Supabase Auth OAuth 2.1 Server 当前以标准 OIDC scope（`openid` / `profile` / `email`）标识用户身份，不支持任意应用自定义只读 scope 字符串；只读约束由 MCP Server 工具注册表硬性保证（不注册任何写工具，所有工具标注 `readOnlyHint: true`）。

## Decision

1. **在 Supabase Edge Functions 部署只读远程 MCP Server（`supabase/functions/mcp`）**：
   - 采用 Streamable HTTP 无状态传输（`mcp-lite` + `zod`），不依赖跨请求内存 session。
   - 在 `supabase/config.toml` 为 `mcp` 配置 `verify_jwt = false`，由函数提供 RFC 9728 Protected Resource Metadata（`/.well-known/oauth-protected-resource`）并在未携带或携带无效 Bearer Token 时返回 `401` + `WWW-Authenticate` 挑战。
   - 函数内部通过 Supabase Auth `getClaims` / `getUser` 验证 OAuth 2.1 JWT，并用调用方 JWT 构造用户作用域客户端执行查询，不以 `service_role` 读取仓库、Memory 或 Collection。
2. **在 Web 端接入 Supabase Auth OAuth 2.1 Server 授权与管理面**：
   - 新增独立路由 `/oauth/consent`（Wrapped in `RequireAuth`），使用 `supabase.auth.oauth` 完成授权详情展示、批准与拒绝；同步修复登录路由与路由守卫对安全相对路径 `next` 的保留，确保未登录访问同意页时可无缝回跳。
   - 在 Settings 新增 **MCP 访问 / 已连接客户端** 分区，展示只读远程 MCP Endpoint 并支持列出与撤销已授权的 OAuth 2.1 客户端（`listGrants` / `revokeGrant`）。
3. **提供 7 个只读 MCP 工具**：
   - `get_library_summary`、`search_stars`、`get_repo`、`list_collections`、`get_collection`、`get_related_repos`、`read_repo_readme`。
   - 数据查询走 6 个新建 `security invoker` Postgres RPC（仅授权 `authenticated`）。
   - `read_repo_readme` 先在用户 RLS 客户端校验 `user_stars` 成员关系，可选复用服务端 `github_sync_credentials` 解密/刷新逻辑取得用户 GitHub Token（缺失时对公开仓库回退匿名请求），向 GitHub 拉取原始 Markdown（`Accept: application/vnd.github.raw+json`）并做安全截断；README 仍不持久化到数据库（ADR 0011）。
4. **抽取 Edge Functions 共享基座（`supabase/functions/_shared/`）**：
   - 抽取 CORS、Bearer JWT 鉴权与加密 GitHub 凭据读写/刷新逻辑至 `supabase/functions/_shared/`，消除 `sync-stars`、`read-repo-readme`、`ask-generate` 与 `mcp` 之间的重复实现。

## Consequences

- `knowledge/contracts/*`、`roadmap.md` 与 `runbooks/self-host.md` 同步授权只读远程 MCP 与 `/oauth/consent` 表面；RepoSnapshot、Research Session、联网搜索、动态 Constellation 等仍未获授权。
- Ask Asterism（ADR 0045）继续保持浏览器目录常驻 Agent + 客户端 BYOK 架构，不受本决策影响。
- 若未来需要通过 MCP 写入 `memories` / `collections` 或把查询词 embedding 搬到服务端，必须新开 ADR。
