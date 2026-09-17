# BACKLOG · 开放项

> 本文件只保留尚未解决的工作。已完成历史见 `PROGRESS.md`、`knowledge/logs/` 与 ADR。

## 当前 frontier

- [ ] **完成 Memory + Why I saved this 真实运行验收与 Issue 结项（GitHub #37）**：本地代码、自动化测试、桌面/手机视觉 QA、远端 Supabase migration (`20260917120000_memory_foundation.sql`) 推送与 `sync-stars` Edge Function 部署已完成。验证真实会话后关闭 #37。按 ADR 0038 不迁移旧 Note，也不兼容 v1/v2 JSON。

## 延后但保留

- [ ] **统一 Retrieval**：等待 #37 完成、产生真实 Memory 数据与使用反馈后再定义并创建 issue。当前混合搜索、Related Stars 与 embedding 继续作为基础能力维护。
- [ ] **浏览器扩展**：保留 WXT 骨架；Memory / Retrieval 稳定后重新定义 popup、GitHub 页面入口、共享会话与 en / zh-CN i18n，不沿用旧 Star Manager 路线直接扩建。
- [ ] **桌面端**：保留 Tauri 2 骨架；在 Web 的 Memory / Retrieval 任务稳定后再排期。
- [ ] **自定义公共域名**：非功能阻断；绑定时同步 README、runbook 与 Supabase Auth URL。
- [ ] **首个公开版本发布工程**：准备 `v0.1.0` 前验收 semver、Changesets、Changelog、Git tag 与 release notes。
- [ ] **Web 主 chunk 性能观察**：Vite 仍有默认 500 KB warning；不抬高阈值，不在没有 Core Web Vitals、低端设备加载时间、流量或成本证据时盲目拆包。

## 未获授权的长期方向

AI Chat / Ask、联网搜索、RepoSnapshot、Resurface、Research Session、MCP、动态 Constellation、Taste Graph、Idea Collision 与星图 UI 仅存在于 `proposals/asterism-transformation-roadmap.md`，不是 backlog，也不得提前实现。
