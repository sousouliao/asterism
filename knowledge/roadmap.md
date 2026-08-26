# Asterism · 路线图（Roadmap）

> 本文是分阶段路线图（契约/规划层）。每个阶段标注目标与里程碑，作为后续 loop 验收与进度跟踪（`state/PROGRESS.md`）的依据。各阶段开发需另行批准。

## 当前状态（Current Status）

- **Phase 0 已验收（2026-06-29）**：Monorepo 实包、共享包骨架、CI、初始 schema + RLS 迁移、GitHub OAuth 登录均完成并端到端验证；设计 token（GitHub Primer）已定稿并落 `packages/ui`。详见 `state/PROGRESS.md`。
- **Phase 1 已完成**：Web MVP 用户可见主流程、真实 Supabase 核心链路、七项最终收尾与四道工程门禁已于 2026-07-18 全部验收。
- **Phase 2 已完成并收敛**：可靠手动批量整理、选中导出、浏览器内 embedding、隐形混合搜索与 Related Stars 已交付；服务端 AI 整理及 BYOK Generation 于 2026-08-05 按 ADR 0032 退役。
- **当前产品 frontier 为 Phase 3 浏览器扩展**：Phase 2.2 Collection Dial 已由 ADR 0036 从产品中退役（#30–#34 实现链此前已关闭）。ADR 0035 Tag 退役 cutover 已于 2026-08-19 落地，组织关系只保留 Collection。扩展不得实现「页内打标签」，也不得复活 Collection Dial。

| 阶段 | 名称 | 状态 |
| --- | --- | --- |
| Phase 0 | 脚手架 Scaffold | 已验收（Done, 2026-06-29） |
| Phase 1 | Web MVP | Done（2026-07-18） |
| Phase 2 | 批量整理 + 浏览器内语义检索 | Done（2026-08-05，AI 整理已退役） |
| Phase 2.2 | Collection Dial | Retired（ADR 0036，2026-08-27） |
| — | Tag 退役 cutover（ADR 0035） | Done（2026-08-19） |
| Phase 3 | 浏览器扩展 Extension | 未开始 |
| Phase 4 | 桌面 Desktop | 未开始 |

---

## Phase 0 · 脚手架（Scaffold）

目标：把蓝图变成可运行的最小工程骨架，打通"登录 + 读取 star"的端到端链路基础。

里程碑：

- Monorepo 实包就位：`apps/{web,extension,desktop}` 与 `packages/{core,ui,db,config}` 的最小可构建骨架。
- 共享包骨架：`core`（GitHub API/同步/模型）、`ui`（shadcn + Tailwind 基底）、`db`（Supabase 客户端 + 查询）的导出边界与占位实现。
- Supabase 项目就绪：建项目、初版 schema、启用 RLS（表结构按 `contracts/data-model.md`）。
- GitHub OAuth 打通：Supabase Auth GitHub provider 配置完成，可完成登录回流。

完成判据：能本地启动 Web 应用、完成 GitHub 登录、并从 Supabase 读到当前用户的基础数据。

## Phase 1 · Web MVP

目标：交付可日常使用的 Web 端 GitHub Star 管理器。

里程碑：

- 同步 stars：拉取用户 star 列表并入库（增量/全量）。
- 列表展示：卡片/列表视图 + **虚拟滚动**（TanStack Virtual），支撑上万条无卡顿。
- 多维筛选与搜索：按语言、topics、时间等过滤 + 关键词搜索。
- 标签（tags）、集合（collections）、笔记（notes）：用户侧组织能力。ADR 0035 已退役 Tag，现在只保留集合与笔记。
- 统计仪表盘：语言/时间/集合等维度的可视化（shadcn Charts）。
- 导入 / 导出：数据可迁移（如 JSON/CSV）。

完成判据：用户可登录、同步、用集合与笔记组织、搜索筛选并查看统计，数据按 RLS 隔离且经 `packages/db` 从 Postgres 读取；提供可执行的 Supabase Cloud + 静态托管自部署文档。当前不承诺离线浏览、主动跨会话推送或完整 Supabase Docker 自托管。Phase 1 交付的标签已由 ADR 0035 迁入集合。

## Phase 2 · 批量整理 + 浏览器内语义检索

目标：深化 Web 端的可靠整理与查找能力，再扩展到新端。

里程碑：

- 手动选择或“全选当前筛选结果”在确认时固化 repository ID 范围。
- 集合写入使用持久化逐关系账本，成功项保留，失败项分类并可恢复重试。历史账本仍含只读的标签关系记录。
- 选中仓库可导出 JSON 部分备份、CSV 清单或 Markdown 可读归档。新版 JSON 只写集合与笔记。
- 浏览器内 `multilingual-e5-small` embedding 支撑隐形混合搜索与 Related Stars；向量按用户存于 `user_repo_embeddings`，不写 canonical。
- 不提供服务端 Generation、BYOK Connection、AI 草稿或 Organization Task；历史 AI 执行形成的普通组织关系继续保留，并已由 ADR 0035 迁入 Collection。

完成判据：重度用户可完成可访问、可恢复的手动批量整理，并在 embedding 不可用时无损降级到关键词搜索；全过程不扩大 GitHub OAuth 写权限，不保存 AI Provider credential。

## Phase 2.2 · Collection Dial（已退役）

目标曾是把 ADR 0033 接受的 Browse 直接整理体验重建为生产能力。#30–#34 已交付后，ADR 0036 于 2026-08-27 完整退役该用户面与专用 schema / RPC。整理入口回到 Quick Look 与批量整理对话框；受信 relation head 保留。

完成判据：Browse 无 Grip / 集合盘；`create_bulk_operation` 只接受 `bulk_dialog`；Dial Undo RPC 与 `undo_*` 列不存在；canonical `collection_repos` 不回滚。

## Tag 退役 cutover（ADR 0035）

目标：删除用户自定义 Tag，把成员关系迁入 Collection，并让 Browse / Quick Look / 批量 / 索引按单一组织概念工作。

里程碑：

- 数据迁移：Tag → 同名 Collection，同名合并，关系幂等，baseline head，然后删表。
- Browse 集合筛选、卡片集合名称、Quick Look 与批量不再出现 Tag。
- Collections 索引可搜索，选择器在约 100 个集合时仍可用。
- 导出 v2 只写 Collection；导入兼容 v1 tags。

完成判据：用户面没有 Tag；既有成员关系可在 Collection 中找到；四道工程门禁全绿。已于 2026-08-19 落地；本机无 Docker，pgTAP 与本地 migration apply 未执行。

## Phase 3 · 浏览器扩展（Extension）

目标：把已经成熟的 Web 核心能力带到浏览网页的即时场景。

里程碑：

- WXT（MV3）popup：快速搜索已 star 的仓库。
- content-script：在 GitHub 仓库页内直接加入集合 / 记笔记。
- 共享会话：复用 Supabase 会话或 `chrome.identity.launchWebAuthFlow`，与 Web 端数据互通。
- 扩展专属 i18n：MV3 `_locales` 提供 en / zh-CN。

完成判据：扩展可登录并与 Web 端共享同一份用户数据，可快速搜索，并在 GitHub 页内即时加入集合 / 写笔记。不得实现用户自定义 Tag。

## Phase 4 · 桌面（Desktop）

目标：提供原生桌面体验。

里程碑：

- Tauri 2 套壳复用 Web 前端。
- 桌面端打包与分发流程。

完成判据：桌面应用可安装运行，复用既有 Web 能力与共享包。
