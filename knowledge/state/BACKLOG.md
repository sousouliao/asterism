# BACKLOG · 开放项

> 本文件只保留尚未解决的工作。已完成历史见 `PROGRESS.md`、`knowledge/logs/` 与 ADR。

## 当前 frontier

- [ ] **Memory + Why I saved this（GitHub #37）**：首个完整纵向功能，覆盖一对一 Memory、Notes cutover、Stars sync、Repo Quick Look、失败恢复、i18n、JSON v3、自动化与真实 Supabase smoke。#36 / #38 完成且 CI 绿色后方可开始；不得拆成无法独立验收的横切票。

## 延后但保留

- [ ] **统一 Retrieval**：等待 #37 完成、产生真实 Memory 数据与使用反馈后再定义并创建 issue。当前混合搜索、Related Stars 与 embedding 继续作为基础能力维护。
- [ ] **浏览器扩展**：保留 WXT 骨架；Memory / Retrieval 稳定后重新定义 popup、GitHub 页面入口、共享会话与 en / zh-CN i18n，不沿用旧 Star Manager 路线直接扩建。
- [ ] **桌面端**：保留 Tauri 2 骨架；在 Web 的 Memory / Retrieval 任务稳定后再排期。
- [ ] **自定义公共域名**：非功能阻断；绑定时同步 README、runbook 与 Supabase Auth URL。
- [ ] **首个公开版本发布工程**：准备 `v0.1.0` 前验收 semver、Changesets、Changelog、Git tag 与 release notes。
- [ ] **Web 主 chunk 性能观察**：Vite 仍有默认 500 KB warning；不抬高阈值，不在没有 Core Web Vitals、低端设备加载时间、流量或成本证据时盲目拆包。

## 未获授权的长期方向

AI Chat / Ask、联网搜索、RepoSnapshot、Resurface、Research Session、MCP、动态 Constellation、Taste Graph、Idea Collision 与星图 UI 仅存在于 `proposals/asterism-transformation-roadmap.md`，不是 backlog，也不得提前实现。
