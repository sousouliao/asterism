# Data Model Contract · 数据模型契约

> 本文件定义 Asterism 的 Postgres 数据模型与行级安全（RLS）约束。它是数据层的 verification 依据：迁移与查询都应满足这里规定的结构与隔离规则。schema 以**清晰的字段清单**呈现，便于在 Supabase 迁移中落地。

实现层以 `supabase/migrations/*.sql` 为 schema 与 RLS 的唯一来源；Dashboard 中的任何紧急手工修复都必须立即补等价 migration，禁止环境长期漂移。

## 设计原则

- **`repos` 为全局共享、公共可读**：同一个 GitHub 仓库的元数据全局只存一份，所有用户共享读取，避免重复。
- **用户私有数据按 `user_id` 隔离**：star 关系、集合、笔记、设置等都归属具体用户，彼此不可见。
- **关系尽量规范化**：多对多关系（仓库↔集合）用独立连接表表达。
- **用户组织只保留 Collection（ADR 0035）**：用户命名的分组、工作列表与状态型短标记都写入 `collections` / `collection_repos`。`tags` / `repo_tags` 已由 cutover migration 迁入集合后删除；Tag color 不迁移。
- **进阶能力保持解耦**：`bulk_operations` / `bulk_operation_items` 提供可靠手动批量写入；`user_repo_embeddings` 保存浏览器生成的 derived 向量。AI Provider、草稿、任务与计划表已由 ADR 0032 退役。

约定：所有表含 `id`（主键，uuid 或 bigint，下文不再逐一重复）、`created_at`、`updated_at`（时间戳）。`user_id` 引用 Supabase `auth.users(id)`。

---

## Core Tables · 核心表（MVP）

### `repos` — 仓库全局元数据（公共可读）

每个 GitHub 仓库一行，全局共享。

- `github_id` — GitHub 仓库数字 ID（唯一，幂等同步键）
- `full_name` — `owner/name` 全名
- `name` — 仓库名
- `owner` — 拥有者 / 组织名
- `description` — 仓库描述
- `language` — 主要编程语言
- `topics` — topic 列表（text[]）
- `stargazers` — star 数
- `forks` — fork 数（可选）
- `homepage` — 主页 URL（可选）
- `pushed_at` — 最近一次 push 时间
- `repo_created_at` — 仓库在 GitHub 上的创建时间（可选）
- `archived` — 是否已归档（boolean）
- `is_fork` — 是否为 fork（boolean，可选）
- `synced_at` — 本系统最近一次同步该仓库元数据的时间

关系：被 `user_stars`、`collection_repos` 与 `notes` 引用。

### `user_stars` — 用户的 star 关系

表达"某用户 star 了某仓库"。

- `user_id` → `auth.users(id)`
- `repo_id` → `repos(id)`
- `starred_at` — 用户在 GitHub 上 star 该仓库的时间

约束：`(user_id, repo_id)` 唯一。

### `tags` / `repo_tags` — 已退役（ADR 0035）

Cutover migration `20260819120000_retire_user_tags.sql` 已按 `normalize_classification_name` 把每个 Tag 转为或合并进 Collection，幂等写入 `collection_repos` 与 baseline `collection_relation_heads`，然后删除这两张表。`color` 丢弃。规格见 `logs/2026-08-19-retire-user-tags.md`。

### `collections` — 用户集合

- `user_id` → `auth.users(id)`
- `name` — 集合名
- `description` — 集合描述（可选）

约束：`(user_id, name)` 唯一。

### `collection_repos` — 集合↔仓库连接表（多对多）

- `user_id` → `auth.users(id)`（冗余，便于 RLS 过滤）
- `collection_id` → `collections(id)`
- `repo_id` → `repos(id)`
- `position` — 集合内排序位（可选）

约束：`(collection_id, repo_id)` 唯一。

### `notes` — 仓库笔记

- `user_id` → `auth.users(id)`
- `repo_id` → `repos(id)`
- `body` — 笔记正文（markdown 文本）

约束：MVP 下 `(user_id, repo_id)` 唯一（每仓库一条笔记）；如未来需多条可放开。

---

## Phase 2 Tables · 进阶表（批量整理 / 语义检索）

### `bulk_operations` — 持久化批量操作

- `user_id` — 操作所属用户
- `source` — `manual` / `promotion`；当前产品只创建 `manual`，保留 `promotion` 仅为历史兼容
- `interaction` — 仅 `bulk_dialog`。ADR 0036 已删除 `collection_dial` / `collection_dial_undo` 账本行、Undo 列与对应 RPC；列本身保留，新产品只创建批量对话框操作
- `client_request_id` — 客户端请求幂等键；`(user_id, client_request_id)` 唯一
- `source_repo_ids` — 确认时固化的 repository ID 范围
- `status` — `pending` / `running` / `needs_attention` / `completed`
- `completed_at` — 完成时间（可选）

用户确认后才创建操作。范围不随筛选变化或后续同步改变；状态由逐关系项目汇总。创建 RPC 按完整 `source_repo_ids` 展开 items，不再接受缺失子集。AI 来源的 operation 与草稿幂等字段已随 ADR 0032 删除；Collection Dial 账本与 Undo 字段已随 ADR 0036 删除。

### `bulk_operation_items` — 批量关系变更

- `operation_id` → `bulk_operations(id)`
- `user_id`、`repo_id`
- `relation_type` — `tag` / `collection`；cutover 后新建只允许 `collection`，历史 `tag` 行保留为账本事实
- `target_id` — 目标集合 ID；历史 `tag` 行指向已删除的标签 ID，仅用于解读旧账本
- `action` — `add` / `remove`
- `status` — `pending` / `running` / `succeeded` / `retryable_failed` / `terminal_failed` / `dismissed`
- `attempt_count`、`last_error_code`、`last_error_message`
- `effective_changed` — 本 item 是否真实改变 canonical 关系；幂等 no-op 为 false
- `effective_mutation_id` — 真实变更产生的受信 receipt；no-op 为空

约束：`(operation_id, repo_id, relation_type, target_id, action)` 唯一。实际关系写入只由受信 `bulk-organize` 执行器完成。

### `collection_relation_heads` — 集合关系最后有效变更

为 ADR 0034 保存集合关系的当前存在状态和最后一次有效变更身份，供 Quick Look、导入与批量执行做并发 / 幂等保护；删除关系后 head 仍保留。ADR 0036 已关闭 Collection Dial Undo 产品面，head 不再服务短期 Undo RPC。

- `user_id`、`collection_id`、`repo_id`
- `present` — 当前 canonical `collection_repos` 是否存在
- `version` — 每次真实 INSERT / DELETE 单调递增；幂等 no-op 不变
- `effective_mutation_id` — 最后一次真实关系变更的 UUID
- `last_operation_item_id` — 该变更由 bulk item 产生时记录其身份；普通用户写入为空

约束：`(user_id, collection_id, repo_id)` 唯一。所有 collection relation 写路径必须经 `packages/db` 的 typed command / 受信 RPC；迁移为既有关系生成不归属于任何新 operation 的基线 head。

### `user_repo_embeddings` — 仓库语义向量（derived 平面，ADR 0026）

浏览器内 embedding 产出的语义向量，按用户存储、客户端直写；属 **derived 数据**，可随模型升级重算，永不写入 canonical。

- `user_id` → `auth.users(id)`
- `repo_id` → `repos(id)`
- `embedding` — pgvector 向量；默认模型 `multilingual-e5-small` 为 384 维
- `embedding_model` — 产出该向量的模型 ID（= `packages/core` 全局常量，版本化以支持可逆升级）
- `content_hash` — 被嵌文本（`full_name` + `description` + `topics`）的哈希，用于探测过期并触发增量重嵌

约束：`(user_id, repo_id)` 唯一。回填 = 求「无行 / `embedding_model` 失配 / `content_hash` 失配」集合，天然增量、可续跑。个人量级按 `user_id` 过滤后精确扫描即毫秒级，**先不建 ANN 索引**（HNSW / IVFFlat 留待规模变大再引入）；维度随默认模型变化需 `alter` + 全库重嵌。查询向量在浏览器内嵌入后，只把向量发到用户自有 Postgres 做距离检索，原文不出设备。

---

## Row Level Security · 行级安全（RLS）

所有表启用 RLS。策略遵循"`repos` 全局可读，其余按 `user_id` 隔离"。

- **`repos`**
  - SELECT：全局可读（所有已认证用户均可读）。
  - INSERT / UPDATE：仅由受信路径写入（同步逻辑 / Edge Functions / service role），普通用户不可直接写。

- **`user_stars` / `collections` / `notes` / `user_repo_embeddings`**
  - SELECT / INSERT / UPDATE / DELETE：均要求 `user_id = auth.uid()`。
  - 用户只能读写自己的行，无法看到或修改他人数据。
  - `tags` / `repo_tags` 已由 ADR 0035 cutover 删除。

- **`collection_repos` / `collection_relation_heads`**
  - SELECT：要求 `user_id = auth.uid()`。
  - 普通客户端不直接 INSERT / UPDATE / DELETE；集合关系只经校验 `auth.uid()`、仓库成员关系与集合归属的受信 typed command / RPC 改变，确保每次有效变更都有 ADR 0034 mutation identity。

- **`bulk_operations` / `bulk_operation_items`**
  - SELECT：要求 `user_id = auth.uid()`，客户端可读取本人的操作进度与结果。
  - INSERT / UPDATE / DELETE：普通客户端无直接表权限；创建、执行、重试与明确结束只经受信批量写入路径完成。
  - 受信路径必须校验操作、项目、仓库成员关系以及目标集合都属于当前用户。cutover 前仍校验历史标签目标。

> 通用规则：只有 `repos` 全局可读；用户私有数据都以 `auth.uid()` 与行内 `user_id` 匹配作为访问前提。连接表冗余存 `user_id` 即为简化此类 RLS 过滤。
