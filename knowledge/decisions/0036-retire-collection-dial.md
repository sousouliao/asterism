# ADR 0036 · 退役 Collection Dial

- Status: Accepted
- Date: 2026-08-27
- Supersedes: ADR 0033；以及 ADR 0034 的产品 Undo 面（30 秒 Undo RPC、Undo 列、`collection_dial` / `collection_dial_undo` interaction）
- Preserves: ADR 0023 手动批量账本；ADR 0034 的 `collection_relation_heads` 与受信 collection mutation（Quick Look、导入、`bulk-organize` executor 仍需要）

## Context

Phase 2.2 已把 Collection Dial 做成 Browse 的拖拽整理入口（Grip、底部半圆盘、More / New、持久 `collection_dial` operation 与短期 Undo）。用户现在要求把该能力从产品中清理干净，整理入口只保留 Quick Look 与批量整理对话框。

继续保留一套专用交互、专用 interaction、Undo RPC 和 item 子集参数，会让 Browse、bulk-organize 与 schema 继续承担用户不再使用的复杂度。退役必须覆盖 Web 用户面和 Supabase 专用路径，但不能拆掉所有集合写入已经共用的受信 mutation 缝，也不能回滚已经写入的 `collection_repos`。

## Decision

完整退役 Collection Dial 运行时：

- 删除 Browse Grip、底部集合盘、More / New overlay、Dial ledger / Undo UI、专用 reducer / hook、许可文件夹资产与 `collectionDial.*` 文案。
- 删除 `create_collection_dial_undo`、`has_unfinished_multi_collection_dial_operation`；`create_bulk_operation` 去掉 `p_item_repo_ids`，新操作只允许 `interaction = 'bulk_dialog'`。
- 删除 Dial 账本行（先 `collection_dial_undo`，再 `collection_dial`）以及全部 `undo_*` 列、相关索引与 CHECK。`interaction` CHECK 收缩为只允许 `bulk_dialog`。
- `apply_collection_relation_mutation` 去掉 Undo receipt 查找与 `undo_expires_at` 写入，改为直接调用 `apply_collection_relation_mutation_unchecked`。
- `bulk-organize` 删除 `undo` action 与 Dial create 分支。
- 不回滚 Dial 已经写入的 `collection_repos`。它们已经是 canonical 用户数据。
- 保留 `collection_relation_heads`、`mutate_collection_relation`、`apply_collection_relation_mutation`、手动批量整理与 `client_request_id` 幂等。

历史 migration、ADR 0033 / 0034 和日志不删除。新环境必须顺序重放历史 migration，再由本决策的追加 migration 收敛到当前 schema。

## Consequences

- Browse 不再提供拖拽进集合的直接整理入口；加入或移出集合继续走 Quick Look 与批量整理对话框。
- 受信 collection mutation 与 relation head 继续保护 Quick Look、导入和批量执行的并发与幂等，不再服务 Dial Undo。
- 已部署实例应用 migration 后，还应部署不再含 `undo` 的 `bulk-organize`。仓库只负责声明目标 schema 和函数源码，不自动变更远端部署状态。
- 若未来重新提出 Browse 直接整理，必须以新的产品证据和 ADR 重新立项，不能直接复活本次删除的 Dial 状态机、Undo RPC 或 `collection_dial` interaction。
