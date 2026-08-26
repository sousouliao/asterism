# 2026-08-27 · 退役 Collection Dial

## 背景

用户要求把 Browse「拖拽仓库 → 底部集合盘」整功能从产品中清理干净，整理入口只留 Quick Look 与批量整理对话框。Supabase 侧同步收掉 Dial RPC、Undo 列、item 子集参数和 `bulk-organize` undo 路径。边界对齐 ADR 0032：删运行时，不删历史 migration / ADR / logs，不回滚已经写入的 `collection_repos`。

## 执行

- 新增 ADR 0036；0033 标为 Superseded；0034 保留 relation head / 受信 mutation，产品 Undo 面退役。
- 删除 Dial UI、core reducer、许可文件夹资产、Web hook / overlay / ledger、`collectionDial.*` i18n，并从 Browse 卡片 / 列表断开 Grip。
- 追加 `20260827000000_retire_collection_dial.sql`：先删 `collection_dial_undo` 再删 `collection_dial` 账本；drop Undo RPC 与 `undo_*` 列；`interaction` CHECK 只允许 `bulk_dialog`；重建 6 参 `create_bulk_operation`；`apply_collection_relation_mutation` 直接调用 unchecked。
- `bulk-organize` create 只接受 `bulk_dialog`；删除 `itemRepoIds` 与 `undo` action。
- `packages/db` 投影去掉 undo 字段与 Dial RPC；Related Stars 的 `selectFreshRepoEmbeddingVectors` 改为本地 `{ repoId, vector }` 类型。
- pgTAP 删除 Dial / Undo 断言，改为覆盖 RPC 已不存在以及 create 拒绝 `collection_dial`。

## 验收

- `pnpm lint` / `typecheck` / `test` / `build` 均通过。lint 先修正了 `repo-card.tsx` 与 `bulk-operations.test.ts` 的 Biome 格式。
- 浏览器：本地 `vite preview`（`http://127.0.0.1:4173/`）重定向到 `/login`，GitHub OAuth 阻断，未能进入已登录 Browse 核验 Quick Look 加入/移出集合或选择模式批量整理对话框。登录页无 Grip / 底部集合盘。生产构建 `apps/web/dist` 不含 `collection-dial` / `CollectionDial` / `collectionDial` 字符串；`repo-card` / `repo-table` 组件测试覆盖点击选择且无 Grip 残留 padding。
- 本机无 Docker：未运行 `pnpm test:db`，未对本地或远端 Postgres apply migration，未部署 `bulk-organize`。维护者之后对 `hqtrmulypxwdqvzlkhke` apply `20260827000000_retire_collection_dial.sql` 并部署函数。
- 未提交、未 push。
