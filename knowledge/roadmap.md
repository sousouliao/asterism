# Asterism · 路线图（Roadmap）

> 本文是已批准的阶段路线图。长期构想见 `proposals/asterism-transformation-roadmap.md`；该提案不自动授权实施，具体工作仍以 Contracts、Accepted ADR 与 GitHub issue 为准。

## 当前状态

Asterism 已从 GitHub Star Manager 转向 **Personal Open Source Memory**（ADR 0037）。GitHub Stars 是首个 Memory 来源；Collection 保留为次级人工组织能力。GitHub #37 **Memory Foundation · Why I saved this** 已完成本地实现，当前等待真实 Supabase 验收。

| 阶段 | 状态 | 结果 / 边界 |
| --- | --- | --- |
| Phase 0 · Scaffold | Done（2026-06-29） | Monorepo、Supabase、OAuth 与工程门禁 |
| Phase 1 · Web MVP | Done（2026-07-18） | 同步、浏览、筛选、Collection、Note、统计与导入导出 |
| Phase 2 · Reliable organization + semantic retrieval | Done（2026-08-05） | 可靠批量整理、混合搜索、Related Stars；服务端 AI 整理已退役 |
| Phase 2.2 · Collection Dial | Retired（ADR 0036） | 专用用户面、账本与 Undo 已删除 |
| Product Repositioning | Done（ADR 0037） | Personal Open Source Memory 成为正式定位 |
| Memory Foundation | **Local implementation done; remote validation pending** | #37：一对一 Memory 与 “Why I saved this” 完整纵向切片 |
| Unified Retrieval | Not approved | 等 Memory 数据与反馈形成后另行立项 |
| Browser Extension / Desktop | Deferred | Memory / Retrieval 基础稳定后重新排期 |

## 已交付基础

- GitHub OAuth 与增量 Stars 同步。
- 响应式 Web、卡片 / 列表虚拟滚动、多维筛选和统计。
- Collection、Memory、可靠手动批量整理与部分导出。
- 浏览器内 embedding、隐形混合搜索与 Related Stars。
- Postgres source-of-truth、RLS、`packages/db` 数据边界与写失败恢复。
- JSON v3 Memory 导入导出；不兼容 v1/v2。

这些能力是 Memory 方向的基础资产，不因产品转向而重做。暂停新增 Collection Management，不恢复 Tag、Collection Dial、服务端 BYOK Generation 或 AI 整理。

## Memory Foundation · 远端验收阶段

目标：让每个已同步 Repo 都拥有一条属于当前用户的 Memory，并允许用户明确记录为什么保存及自由笔记。

GitHub #37 的本地实现已覆盖：

- 每个 `(user_id, repo_id)` 一条基础 Memory。
- Star 同步幂等创建，绝不覆盖用户内容。
- 按 ADR 0038 直接退役旧 Note 模型，不保留数据迁移或兼容接口。
- Repo Quick Look 提供 `whySaved` 与 `note` 的加载、编辑、清空、保存和失败恢复。
- 原因为空时明确显示未记录，不使用 AI 猜测。
- JSON v3 读写 Memory；v1/v2 不再兼容导入。
- 领域类型、数据访问、UI、i18n、测试和知识库作为一个端到端 issue 交付。

剩余完成判据是 linked Supabase migration、更新后的 `sync-stars` 部署，以及真实 migration / RLS / repair smoke；通过前 #37 保持开放。

## Memory Foundation 之后

下一候选方向是统一 Retrieval：把现有关键词匹配、语义近邻、Related Stars 与用户 Memory 组合成面向意图的检索。只有在 #37 完成并产生真实 Memory 数据和使用反馈后，才创建对应 issue 和验收标准。

以下方向只保存在长期提案中，尚未获得实现授权：AI Chat / Ask、联网搜索、RepoSnapshot、Resurface、Research Session、MCP、动态 Constellation、Taste Graph、Idea Collision 与星图 UI。

## 延后客户端

浏览器扩展（WXT）和桌面端（Tauri 2）骨架保留，不删除、不继续扩展。它们必须在 Memory / Retrieval 基础稳定后重新定义用户任务；不得沿用旧路线仅复制 Star Manager 的 Collection / Note 入口。
