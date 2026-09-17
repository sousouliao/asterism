# PROGRESS · 项目进度与恢复点

> 这里只记录当前状态、已完成里程碑和下一恢复点。详细执行历史见 `knowledge/logs/`，决策理由见 `knowledge/decisions/`，开放项见 `BACKLOG.md`。

## 当前状态

- **产品定位**：Personal Open Source Memory（ADR 0037）。Asterism 是开源、可自部署的个人开源软件记忆库，GitHub Stars 是首个来源。
- **当前功能 frontier**：GitHub #37 `feat(memory): add Why I saved this`。领域模型、schema migration、同步 repair、数据访问、Quick Look、i18n、JSON v3、自动化与视觉 QA 已在本地完成；远端 Supabase migration (`20260917120000_memory_foundation.sql`) 与 `sync-stars` Edge Function 已成功部署上线。
- **本轮边界**：直接切换到新 Memory 模型；不迁移旧 Note，不兼容 v1/v2 JSON，不扩展到 Retrieval、Ask、Snapshot、Research 或 MCP。
- **延后方向**：统一 Retrieval 等 #37 数据与反馈；Extension / Desktop 等 Memory / Retrieval 稳定。AI Chat、联网搜索、Snapshot、Research、MCP、动态 Constellation、Taste Graph、Idea Collision 与星图 UI 均未立项。

## 已完成里程碑

- **2026-09-17 · Memory Foundation 实现与远端部署**：每个 `user × repo` 一条 Memory，承载 `whySaved` 与 `note`；Stars 同步幂等补齐基础 Memory，Quick Look 提供双字段编辑、清空、失败恢复与双语界面，导入导出升级为仅支持 JSON v3。桌面与手机视觉 QA、四道本地门禁均通过；远端 Supabase 项目恢复后，已成功完成 migration push 与 `sync-stars` Edge Function 部署。见 ADR 0038 与 `logs/2026-09-17-memory-foundation.md`。
- **2026-09-17 · 产品转向**：保存长期提案，发布 #36 / #37，接受 ADR 0037，统一 Product / Architecture / Data Model / UI-UX Contracts、Roadmap、README 与公开文案。Collection 降为次级人工组织能力，Memory Foundation 成为 frontier。见 `logs/2026-09-17-memory-transformation-issues.md` 与 `logs/2026-09-17-personal-open-source-memory-repositioning.md`。
- **2026-09-17 · 起步基线清理**：GitHub #38 修复退役 RPC pgTAP 调用与测试污染，移除过期 retrieval scratch，阻止 DEV corpus lab 进入生产包，并消除测试 storage 警告。见 `logs/2026-09-17-clean-pre-pivot-baseline.md`。
- **2026-08-27 · Collection Dial 退役**：ADR 0036 删除专用用户面、账本与 Undo；canonical Collection 数据和通用受信 mutation 保留。
- **2026-08-19 · Tag 退役**：ADR 0035 将 Tag 合并进 Collection，用户组织关系统一为 Collection。
- **2026-08-05 · AI 整理退役**：ADR 0032 删除服务端 BYOK Generation 与 AI Organization，保留可靠手动批量整理。
- **2026-07-27 · Retrieval 基础完成**：浏览器内 embedding、隐形混合搜索与 Related Stars 落地；二维星图按 ADR 0028 删除。
- **2026-07-18 · Phase 1 Web MVP 完成**：登录、同步、浏览、筛选、Collection、Note、统计、导入导出、写失败恢复和四道工程门禁完成。
- **2026-06-29 · Phase 0 完成**：Monorepo、共享包、Supabase、OAuth 与 CI 骨架验收。

## 下一恢复点

1. 验证生产/线上环境真实登录与同步，确认 Memories 读写与 Star 基础 Memory 补齐正常。
2. 验收通过后关闭 #37；此前不创建 Retrieval、Ask、Snapshot、Research 或 MCP issue。

## 环境提示

- 本机当前没有可用 Docker，因此 `pnpm test:db` 需由 GitHub Actions 的本地 Supabase job 验证。
- 维护者 Supabase project ref 为 `hqtrmulypxwdqvzlkhke`；任何远端 migration / function 变更都需按 runbook 显式部署与 smoke，不因本地代码提交自动生效。
