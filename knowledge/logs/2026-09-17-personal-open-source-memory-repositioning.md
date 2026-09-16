# Personal Open Source Memory repositioning

Date: 2026-09-17  
GitHub: #36

## Outcome

- 接受 ADR 0037：Asterism 定位为 **your private memory for open-source software**，GitHub Stars 是首个来源而不是产品终点。
- 首版领域关系固定为每个 `user × repo` 一条 Memory，承载来源、来源时间、`whySaved` 与 `note`；缺失原因不得由 AI 猜测。
- Collection 保留为次级人工组织能力，暂停新增 Collection Management。
- Memory Foundation 成为当前唯一功能 frontier；Extension / Desktop 延后到 Memory / Retrieval 基础稳定之后。
- Product、Architecture、Data Model、UI/UX Contracts、Roadmap、README、应用产品上下文与公开品牌文案已统一。
- 现有混合搜索、Related Stars、浏览器内 embedding、Note、Stars 同步与可靠写入明确作为迁移资产复用。
- AI Chat、联网搜索、RepoSnapshot、Research Session、MCP、动态 Constellation、Taste Graph、Idea Collision 与星图 UI 继续只存在于长期提案中，没有实现授权。

## State hygiene

`PROGRESS.md`、`BACKLOG.md` 与 `NOTES.md` 已压缩为当前恢复信息；详细历史继续由既有 logs 和 ADR 保存，不删除审计记录。

## Scope boundary

本轮没有实现 #37：没有新增 `memories` migration、领域类型、数据访问、同步写入、Quick Look Memory 编辑或 JSON v3。#37 在 #36 / #38 完成且 CI 绿色后才可领取。
