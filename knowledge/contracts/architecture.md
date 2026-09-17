# Architecture Contract · 架构契约

> 本文件定义 Asterism 的系统架构、技术栈、monorepo 蓝图、数据流与鉴权权限边界。架构变更须同步更新本文件，并在 `../decisions/` 记录对应 ADR。

## System Architecture · 系统架构

多端客户端共享 `core` / `ui` / `db` 三个包，统一对接 Supabase（Auth / Postgres / Edge Functions）；GitHub GraphQL / REST API 是首个上游数据源。当前运行表面仍是 Web；Extension / Desktop 在 Memory Foundation 与统一 Retrieval 稳定后再恢复实施。

```mermaid
flowchart TD
  subgraph clients [多端客户端]
    web[Web SPA / Vite+React]
    ext[Extension / WXT MV3]
    desktop[Desktop / Tauri 2]
  end
  subgraph shared [共享包 packages]
    core[core: GitHub API/同步/Memory 领域模型]
    ui[ui: shadcn组件+Tailwind]
    db[db: Supabase客户端+查询]
  end
  subgraph supabase [Supabase]
    auth[Auth: GitHub OAuth]
    pg[(Postgres)]
    fn[Edge Functions: sync-stars / read-repo-readme / bulk-organize]
  end
  gh[GitHub GraphQL / REST API]

  web --> shared
  ext --> shared
  desktop --> shared
  shared --> auth
  shared --> pg
  core --> gh
  fn --> gh
  fn --> pg
```

### 分层职责

- **clients（端）**：各端只负责平台壳与组装，业务逻辑下沉到共享包。
- **shared（共享包）**：跨端复用的核心；不含任何平台专有 API（见 `conventions.md` 目录边界）。
- **Supabase（后端）**：Auth 鉴权、Postgres 作为 source-of-truth、Edge Functions 承载同步、README 代理与批量整理等受信服务端逻辑。业务数据不使用 Realtime 订阅；客户端在查询边界重新读取权威状态。
- **GitHub GraphQL / REST API**：上游数据源；stars 同步走 GraphQL，实时 README HTML 走受保护 Edge Function 调用 REST。

## Tech Stack · 技术栈

### 共享（跨端）

- **语言**：TypeScript（strict）
- **UI**：React + Tailwind CSS + shadcn/ui
- **数据请求 / 缓存**：TanStack Query
- **客户端状态**：Zustand
- **请求缓存**：TanStack Query（仅会话内；不承诺离线浏览）
- **大列表性能**：TanStack Virtual（虚拟滚动）
- **国际化**：react-i18next（跨 web / 扩展通用，最稳；默认 en + 内置 zh-CN）

### 各端

- **Web**：Vite + React + React Router；静态托管（Vercel / Netlify / Cloudflare Pages）。
- **Extension**：WXT（Manifest V3）；鉴权用 `chrome.identity.launchWebAuthFlow` 或共享 Supabase 会话。
- **Desktop**：Tauri 2，套用 web 前端。

### 运行时与工程基线

- Node 22 LTS、pnpm（`packageManager` 锁定）、Turborepo、Vite、Vitest、Biome、Changesets、lefthook + commitlint。
- 选型理由见 `../decisions/0001-supabase-baas.md`、`0002-pnpm-over-bun.md`、`0003-commitlint-lefthook.md`。

## Monorepo Blueprint · 仓库蓝图

> 本次初始化仅建立 monorepo 根配置，**不创建** `apps/*` 与 `packages/*` 的业务代码。下方为目标蓝图。

```text
asterism/
├── apps/
│   ├── web/            # Vite + React + React Router 的响应式 Web
│   ├── extension/      # WXT MV3 浏览器扩展
│   └── desktop/        # Tauri 2 桌面端
├── packages/
│   ├── core/           # 业务逻辑：GitHub API / 同步 / 领域模型（无平台专有 API）
│   ├── ui/             # shadcn/ui 组件 + Tailwind 设计系统
│   ├── db/             # 数据访问唯一入口：Supabase 客户端 + 查询
│   └── config/         # 共享工程配置（tsconfig / tailwind / biome 预设等）
└── supabase/
    ├── migrations/     # 数据库迁移（schema + RLS）
    └── functions/      # Edge Functions（sync-stars / read-repo-readme / bulk-organize）
```

包命名遵循 `@asterism/*`；共享包为私有 workspace（不发 npm）。目录边界规则见 `conventions.md`。

## Data Flow · 数据流

核心数据流：以 GitHub Stars 为首个 Memory 来源、Postgres 为唯一持久化权威源、显式查询为客户端收敛边界、TanStack Query 提供会话内请求缓存。

```mermaid
sequenceDiagram
  participant U as 用户
  participant C as 客户端 (core/db)
  participant Fn as Edge Function sync-stars
  participant GH as GitHub GraphQL
  participant SB as Supabase Postgres

  U->>SB: 1. GitHub OAuth 登录
  SB-->>C: 返回会话 / provider_token
  C->>Fn: 2. 触发同步（用户 JWT + provider_token）
  Fn->>GH: 3. GraphQL 拉取 starred（全量 / 增量）
  GH-->>Fn: 仓库数据
  Fn->>SB: 4. service role 幂等写入 repos + user_stars + 基础 memories
  SB-->>C: 5. 客户端按查询边界读取（RLS：repos 全局读 / user_stars 按 user）
```

1. **OAuth 登录**：经 Supabase GitHub provider 获取会话与 `provider_token`（GitHub 访问令牌）。
2. **触发同步**：客户端调用 Edge Function `sync-stars`，带上用户 JWT 与 `provider_token`。
3. **GraphQL pull stars**：函数调 GitHub GraphQL API 拉取 starred（支持增量）；纯查询/映射逻辑在 `core`。
4. **Postgres source-of-truth**：函数用 **service role** 幂等写入 `repos`（全局）与该用户 `user_stars`；Memory Foundation 落地后同时只创建缺失的基础 `memories`，不得覆盖用户填写的 `why_saved` 或 `note`。`repos` RLS 仅允许受信路径写（见 `data-model.md`），故写入集中在函数，客户端不直写。
5. **读取 / 会话收敛**：客户端按 RLS 读取结果（`repos` 全局可读、`user_stars` 按 `user_id`）；进入页面、查询刷新、完成本地操作或重新连接后重新读取 Postgres。多个在线会话不承诺主动推送收敛。
6. **请求缓存**：客户端使用 TanStack Query 做会话内去重与新鲜度管理；不建立浏览器持久缓存，也不承诺离线读取。

> Stars 同步由受信 Edge Function `sync-stars` 执行，满足「全局 `repos` 仅受信路径写」的 RLS 约束。批量整理继续使用与 AI 无关的持久化执行路径：用户确认后固化 repository ID 范围与逐关系项目，服务端按有界批次执行并记录结果；成功项目保留，恢复时只领取待执行或可重试失败项目，幂等关系写保证重复提交不产生脏数据。客户端只经 `packages/db` 创建、触发、查询、重试或明确结束操作，并在查询边界重新读取权威状态。

> ADR 0032 已退役服务端 AI 整理：运行时不保存 Provider credential，不调用 Generation Provider，也不维护 AI 草稿、任务、计划或同步后整理机会。历史 AI 操作已经写入的普通组织关系仍是 canonical 用户数据，不由退役迁移回滚。ADR 0035 进一步把用户自定义 Tag 迁入 Collection；成员关系保留，Tag color 不迁移。

> 语义能力保持纯浏览器内边界：浏览器生成 repository/query embedding，只把用户向量存入本人 RLS 隔离的 `user_repo_embeddings`，用于隐形混合搜索与 Related Stars；它不经过 BYOK，不自动修改 canonical。ADR 0036 已退役 Collection Dial，embedding 不再用于集合盘候选排序。

README 继续遵循 ADR 0011：只在用户打开工作区时实时获取，HTML 仅有 5 分钟会话内缓存，也不建立搜索索引。

### Memory Foundation boundary

ADR 0037 把 Memory 设为用户与 Repo 的一等关系；ADR 0038 明确采用无旧数据兼容的干净切换。`@asterism/core` 定义领域类型，`@asterism/db` 是读取与保存的唯一入口，`sync-stars` 通过幂等 repair pass 创建缺失基础记录，Web Quick Look 编辑个人上下文。旧 `notes` 运行时与查询接口不再保留。

Collection、混合搜索、Related Stars、embedding、同步与可靠写入保持为可复用能力。统一 Retrieval、Snapshot、Research、MCP 与其他长期能力没有运行时授权。

### README 实时读取

README 工作区走独立的非持久化读取链：Web 路由 → TanStack Query → `packages/db` → `read-repo-readme` Edge Function → GitHub REST。函数必须先校验 Supabase JWT，并确认 `user_stars` 中存在当前用户与 owner/name 对应仓库的成员关系，之后才允许发起 GitHub 请求。`provider_token` 仅用于当前上游请求；缺失时可在成员校验后对公开仓库走匿名 GitHub 请求。TanStack Query 以用户和规范化 owner/name 去重并提供 5 分钟短期内存 freshness；再次请求把缓存 ETag 传给函数，由函数以 `If-None-Match` 条件请求 GitHub，304 时复用匹配的内存 HTML。GitHub 返回的 HTML 不写入 Postgres 或浏览器持久存储，客户端在 `dangerouslySetInnerHTML` 前使用 DOMPurify 与显式 tag / attribute / class 允许列表双重清洗；fragment 只更新当前工作区 hash 并把目标滚入视口、移交程序化焦点，仓库文件与目录分别转为 GitHub `blob` / `tree`，所有离站链接统一使用安全新标签页。清洗结果在 `@asterism/ui` 的 960px 实体 canvas 中渲染，固定使用随应用发布的 MIT `readme-document-v1.css`，loading / loaded 共享 canvas 合同。详见 ADR 0011。

## OAuth & Permissions · 鉴权与权限边界

- **Provider**：Supabase Auth 的 GitHub provider。
- **读取公开 star 列表**：无需额外 scope（用户公开的 starred 数据即可读取）。MVP 为**只读**。
- **GitHub 写操作（unstar / star 等）**：需要 `public_repo` scope，默认不申请。Phase 2 批量整理只写 Asterism 私有数据，明确不包含 GitHub star/unstar；未来若单独引入 GitHub 写功能，必须重新做权限与不可逆操作设计。
- **最小权限原则**：默认申请满足只读浏览所需的最小 scope，避免过度授权。
- **会话**：跨端共享 Supabase 会话；扩展端可用 `chrome.identity.launchWebAuthFlow` 或共享会话两种方式之一。

权限与密钥安全约束见 `conventions.md` 与 `data-model.md`。
