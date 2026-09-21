# Runbook · 自部署 Asterism Phase 1

本手册用于把 Asterism 部署到你自己控制的 **Supabase Cloud 项目 + 静态 Web 托管**。Phase 1 不提供或维护完整 Supabase Docker 自托管栈。

## 前置条件

- Node.js 22、pnpm 8
- Git、Supabase CLI
- 一个 Supabase Cloud 项目
- 一个 GitHub OAuth App
- 一个支持 Vite 单页应用的静态托管平台（Vercel、Netlify、Cloudflare Pages 等）

不要把 Publishable key 以外的密钥提交到仓库，也不要把 Supabase Secret / service-role key 放入前端环境变量。

## 1. 获取代码并安装依赖

```bash
git clone https://github.com/Mournerliao/asterism.git
cd asterism
pnpm install --frozen-lockfile
```

## 2. 关联 Supabase 并应用 migrations

从 Supabase Dashboard 的项目 URL 中找到 project ref，然后在仓库根目录执行：

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

`supabase/migrations/` 是 schema、索引、触发器和 RLS policy 的唯一来源。不要只在 Dashboard 中手工修改线上 schema；紧急修改也应补一份等价 migration。

在 SQL Editor 中确认核心表存在且 RLS 已开启：

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

`repos`、`user_stars`、`collections`、`collection_repos`、`memories` 应全部显示 `rowsecurity = true`。

## 3. 配置 GitHub OAuth

在 GitHub 打开 **Settings → Developer settings → OAuth Apps → New OAuth App**：

- Homepage URL：你的最终 Web 地址；本地验证可先用 `http://localhost:5173`
- Authorization callback URL：`https://<your-project-ref>.supabase.co/auth/v1/callback`

创建后，把 GitHub Client ID 和 Client Secret 填入 Supabase Dashboard 的 **Authentication → Providers → GitHub** 并启用该 Provider。

在 Supabase **Authentication → URL Configuration** 中设置：

- Site URL：生产 Web 地址
- Redirect URLs：加入生产地址和 `http://localhost:5173`

Asterism 只读取公开 Star、公开仓库元数据与公开资料，不申请 `public_repo`，也不会替用户执行 star/unstar。

## 4. 部署 Edge Functions

保持 CLI 已关联目标项目，然后执行：

```bash
supabase functions deploy sync-stars
supabase functions deploy read-repo-readme
supabase functions deploy bulk-organize
supabase functions deploy ask-generate
```

三项函数都使用 Supabase 运行时自动注入的 `SUPABASE_URL` 与 `SUPABASE_SERVICE_ROLE_KEY`；不需要把它们写进仓库或 Web 环境变量。

- `sync-stars`：验证当前 Supabase 用户后，使用其 GitHub provider token 增量同步公开 Star。
- `read-repo-readme`：先验证仓库属于当前用户的 Star 库，再从 GitHub 读取 README；README 不持久化到数据库。
- `bulk-organize`：验证用户与仓库、标签、集合归属，按有界批次幂等写入并持久化逐关系结果；不访问 GitHub，也不执行 star/unstar。

第四项 `ask-generate` 是 Ask Asterism 的无状态 BYOK 代理（ADR 0042 / 0043 / 0044 / 0045）：验证 Supabase 用户后，把客户端组装的 prompt（含目录前缀、`tools` 与 `tool` 消息）以 `stream: true` 转发到用户自带 key 的 OpenAI 兼容上游（Provider 白名单：DeepSeek / OpenAI / Groq / OpenRouter），并把上游 SSE 转换为 Asterism 协议（`event: delta | tool_call | error | done`）；Settings 的连接管理另走 `models`（模型检测）与 `test`（单次连通性检测，ADR 0046 起不再做能力分级）两个 JSON 动作。它不新增任何服务端 secret 或表——用户的 API key 只存其浏览器本地，仅随请求透传，不落日志。不部署此函数时，除 Ask Asterism 问答与连接检测外的全部功能不受影响（检测失败时界面回退手填模型 ID）。目录常驻 Agent 与 SSE `tool_call` 必须重新部署本函数后才生效。

## 5. 配置并验证本地 Web

复制 `.env.example` 为 `.env`，填写 Supabase Dashboard **Project Settings → API Keys** 中的项目 URL 与 Publishable key：

```dotenv
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Publishable key 可以进入浏览器，数据访问仍受 RLS 保护。不要在任何 `VITE_` 变量中放 Secret / service-role key。

启动本地应用：

```bash
pnpm --filter @asterism/web dev
```

打开 `http://localhost:5173`，完成 GitHub 登录并执行一次 Stars 同步。

## 6. 部署静态 Web

托管平台需要设置同样两个构建期环境变量：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

仓库根目录的 `vercel.json` 已给出 Vercel 配置：

- Framework：Vite
- Install：`pnpm install`
- Build：`turbo run build --filter=@asterism/web`
- Output：`apps/web/dist`
- SPA fallback：所有应用路由回写到 `/index.html`

其他平台使用相同构建命令与产物目录，并配置等价的 SPA fallback。部署 URL 确定后，回到 Supabase Auth 更新 Site URL 与 Redirect URLs。

## 7. 部署后验收

按顺序完成以下 smoke test：

1. GitHub OAuth 能登录、刷新页面后会话仍在、退出登录有效。
2. 首次同步能导入 Star；再次同步能增量更新且不会产生重复数据。
3. 标签、集合和笔记可以创建、修改、删除，另一用户不可读取这些数据。
4. Browse 能按名称/描述关键词搜索并组合筛选。
5. README 能覆盖正常读取、无 README、非当前用户 Star、GitHub rate limit 与重试路径。
6. JSON 备份可恢复；CSV 与 Markdown 可下载。
7. 在部署所对应的源码版本运行 `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`，四项全部通过。

## 故障定位

- OAuth 回调失败：核对 GitHub callback URL、Supabase Site URL / Redirect URLs 和浏览器实际 origin。
- Function 404：确认两个函数都部署到了 Web 所连接的同一个 Supabase project ref。
- Function 401：重新登录；确认前端使用 Publishable key，函数请求由 Supabase session 自动携带访问令牌。
- 数据写入被拒绝：确认 migrations 已完整应用、RLS 已开启且当前 session 用户与记录 `user_id` 一致。
- 页面直达 404：为静态托管配置 SPA fallback 到 `index.html`。

Phase 2 历史上的 BYOK credential 服务端加密已由 ADR 0032 退役，不再属于部署面；ADR 0042 的 Ask BYOK key 存于用户浏览器本地，自部署不需要任何 AI 相关 secret 或迁移。
