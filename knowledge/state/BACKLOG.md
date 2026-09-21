# BACKLOG · 开放项

> 本文件只保留尚未解决的工作。已完成历史见 `PROGRESS.md`、`knowledge/logs/` 与 ADR。

## 当前 frontier

- [ ] **个人私有知识问答（GitHub #41）· 目录常驻 Agent 本地实现已交付，待重新部署 `ask-generate` 与真实环境验收**：`feat(ask): catalog-resident agent for Ask Asterism`。生成策略为客户端 BYOK + 目录常驻浅层 Agent + 无状态 `ask-generate` SSE 代理 + read gate、无抽取式兜底（ADR 0042 / 0044 / 0045 / 0046）；core / Edge Function / db / Settings / Ask 面板 / 双语 i18n / dev 预览与四道门禁全部完成（`logs/2026-09-21-ask-catalog-resident-agent.md`、`logs/2026-09-21-ask-drop-capability-gate.md`）。剩余：远端重新部署 `ask-generate` 与 Web、真实账号 smoke（既有连接与同意免手工、目录可见、工具轮次、继续深入）、production 验收后关闭 issue。

## 已完成近期 frontier

- [x] **沉睡记忆唤醒与主页推荐流（GitHub #40）**：`feat(memory): resurface inactive stars and contextual memory streams`。双流卡片、可解释算法、本地反馈、双语与全部门禁已交付（ADR 0041）；真实环境验收通过后 issue 已关闭。
- [x] **完成 Memory + Why I saved this 交付（GitHub #37）**：本地代码、自动化测试、桌面/手机视觉 QA、远端 Supabase migration (`20260917120000_memory_foundation.sql`) 推送、`sync-stars` Edge Function 部署与 GitHub Issue #37 已全部完成关闭。按 ADR 0038 不迁移旧 Note，也不兼容 v1/v2 JSON。
- [x] **统一检索引擎（GitHub #39）**：Memory-aware 词法 / 语义检索、可验证 Match Explanation、可信 Related Stars 降级和 consent v2 已完成；代码复核发现的问题已修正并通过全量门禁。

## 延后但保留

- [ ] **浏览器扩展**：保留 WXT 骨架；Memory / Retrieval 稳定后重新定义 popup、GitHub 页面入口、共享会话与 en / zh-CN i18n，不沿用旧 Star Manager 路线直接扩建。
- [ ] **桌面端**：保留 Tauri 2 骨架；在 Web 的 Memory / Retrieval 任务稳定后再排期。
- [ ] **自定义公共域名**：非功能阻断；绑定时同步 README、runbook 与 Supabase Auth URL。
- [ ] **首个公开版本发布工程**：准备 `v0.1.0` 前验收 semver、Changesets、Changelog、Git tag 与 release notes。
- [ ] **Web 主 chunk 性能观察**：Vite 仍有默认 500 KB warning；不抬高阈值，不在没有 Core Web Vitals、低端设备加载时间、流量或成本证据时盲目拆包。

## 未获授权的长期方向

联网搜索、RepoSnapshot、Research Session、MCP、动态 Constellation、Taste Graph、Idea Collision 与星图 UI 仅存在于 `proposals/asterism-transformation-roadmap.md`，不是 backlog，也不得提前实现。Resurface 与 Ask Asterism 已分别由 GitHub #40 / #41 授权，以上方 frontier 为准。
