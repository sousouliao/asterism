# Personal Open Source Memory proposal and issues

Date: 2026-09-17

## Outcome

- 保存长期产品转型提案：`knowledge/proposals/asterism-transformation-roadmap.md`。
- 提案明确标记为非权威背景材料；Contracts、Accepted ADR 与具体 issue 优先。
- 创建 GitHub #36 `docs(product): reposition Asterism as personal open-source memory`。
- 创建 GitHub #37 `feat(memory): add Why I saved this`。
- 两票均标记 `ready-for-agent`。
- #37 已成为 #36 的 GitHub 子 issue，并由 #36 原生阻塞。

## Scope discipline

#36 只负责产品决策、ADR、Contracts、正式路线图与公开文案，不修改 schema 或运行时。#37 才负责一对一 Memory 的完整纵向实现。统一 Retrieval、Ask、Resurface、RepoSnapshot、Research、MCP、动态 Constellation、Taste Graph 与 Idea Collision 只保留在提案中，尚未创建实现 issue。

## Verification

- 创建前确认 GitHub 没有未关闭 issue。
- 创建后 GitHub 报告 #36 有一个子 issue并阻塞一个 issue；#37 的 `blocked_by` 为 1。
- 本轮未领取 issue、未修改生产代码、未部署，也未实现 Memory 功能。
