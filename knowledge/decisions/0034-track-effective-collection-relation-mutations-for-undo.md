# ADR 0034 · 为 Collection Dial Undo 记录有效集合关系变更身份

- Status: Accepted（relation head / 受信 mutation 仍有效；产品 Undo 面已由 ADR 0036 退役）
- Date: 2026-08-12
- Builds on: ADR 0023、0032、0033、GitHub #29
- Partial supersession: ADR 0036 删除 Collection Dial Undo RPC、Undo 列与 `collection_dial*` interaction；保留本决策的 `collection_relation_heads` 与受信 mutation

## Context

Collection Dial 的每次成功都需要独立短期 Undo，但撤销只能移除该次操作真正新增、且之后没有被用户再次有效修改的集合关系。仅检查 `collection_repos` 当前是否存在，无法区分关系是本次新增、此前已存在，还是在本次操作后被 Quick Look、导入或另一次 Collection Dial 删除并重新添加。

ADR 0030 曾为 Organization Task 提出通用关系 mutation identity，但该任务体系已由 ADR 0032 整体退役，ADR 0030 也随之 supersede。Collection Dial 不能把退役 Task 的 schema 或生命周期恢复为现役能力，仍需为自己的直接整理语义重新建立一个更窄的边界。

## Decision

- 所有集合关系的真实 INSERT / DELETE 都记录受信的 effective mutation identity 和单调 version；幂等 add/remove no-op 不推进身份。
- 使用保留删除后历史的 collection relation head 表，按 `(user_id, collection_id, repo_id)` 唯一标识当前存在状态与最后一次有效变更。
- Collection Dial 的单项和多选都复用 ADR 0023 的持久 bulk operation 生命周期。成功 item 只有在真正改变关系时保存 effective mutation receipt；此前已存在的幂等成功不获得可反转 receipt。
- 原 operation 的短期 Undo 只为当前 head 仍与其 receipt 完全相同的有效新增创建反向 bulk item。任何后续有效变更、过期、目标失效或归属失效都保守跳过并报告冲突。
- 为保证后续用户改动可观测，集合关系写入迁移到 `packages/db` 暴露的 typed command / RPC；普通客户端不再直接写 `collection_repos`，也不能伪造 bulk item identity。
- Undo 只反转集合关系，不删除集合实体；每个原 operation 最多创建一个幂等 undo operation。

## Consequences

- 需要扩展 bulk operation 的 interaction、client request idempotency、item receipt 与 Undo 投影，并为已有集合关系建立不归属任何新 operation 的基线 head。
- Quick Look、导入和 bulk executor 等全部 collection relation 写入入口必须迁移到同一受信变更边界；标签关系不因本决策被迫扩大改造。
- 单项写入也会获得 operation identity、响应丢失恢复与精确 Undo，代价是不能继续走无账本的客户端直写快路。
- 完整接口、状态机和验收条件由 GitHub #29 定义；实现必须先拆 blockers-first tracer-bullet tickets。
