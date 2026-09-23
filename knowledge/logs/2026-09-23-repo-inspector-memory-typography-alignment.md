# 2026-09-23 · 仓库详情抽屉个人记忆与空态字号对齐修复

针对 Repo Quick Look（`RepoInspector`）中「个人记忆」卡片及「集合」空态文字与周围元数据字号不一致的问题进行精确定位与修复：

1. **问题根因**：
   - 根据 `knowledge/contracts/ui-ux.md`，常规元数据统一使用 `text-caption`（12px / 0.75rem），紧凑元数据为 `text-micro`（11px / 0.6875rem）；
   - `MemorySection` 中的字段标签（「为什么收藏它」、「笔记」）以及区块标题（「个人记忆」）使用的是 `text-caption`（12px）；
   - 展示层原本在「尚未记录」和「还没有笔记」处误用了 `text-body`（14px / 0.875rem），导致占位内容字号反而大于其字段标题与区块标题，产生视觉层级倒挂；
   - 同样地，`CollectionsSection` 中未添加集合时的空态提示（`noCollections`）原先也误用了 `text-body`。
2. **修复落地**：
   - 修改 `apps/web/src/components/repo-inspector/memory-section.tsx`：将展示层字号调整为 `text-caption`（12px），与字段标题同级；同时区分状态：无内容占位时为 `text-muted-foreground`，有真实内容时为 `text-foreground/90`；
   - 修改 `apps/web/src/components/repo-inspector/collections-section.tsx`：将 `noCollections` 空态提示对齐为 `text-caption`；
   - 新增 `apps/web/src/components/repo-inspector/memory-section.test.tsx`：针对空态与有内容两种状态下的字号和颜色断言，防止 `text-body` 倒挂回归。

本地验证：
- `pnpm lint`（Biome）全仓通过；
- `pnpm typecheck` 8 个工作区包全部通过；
- `pnpm --filter=@asterism/web test` 55 套件、296 项测试全部通过。
