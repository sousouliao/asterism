# 2026-09-30 · 集合与技术标签视觉解耦及折叠浮层边距优化

## 背景

1. **集合与技术标签视觉混淆**：在仓库卡片与表格的上下文标签行中，用户自定义的「集合（Collections）」与 GitHub 原生「技术标签（Topics）」均以纯文字徽章并排呈现，两者缺乏直观的认知层次，用户无法一眼辨识仓库所属的集合。
2. **基线错位与徽章漂移缺陷**：为集合徽章引入图标后，在 `OverflowChipRow` 中原本的 `display: inline` 外层 `<span>` 因内嵌 SVG 与纯文本徽章的 inline baseline 计算不一致，导致父级 flex 容器（`items-center`）中集合徽章向上漂移约 3px，破坏了水平对齐。
3. **折叠 Tooltip 内外边距失衡**：展开 `+n` 折叠浮层时，`TooltipContent` 继承了基础组件针对单行文本设计的 `px-3 py-1.5`（左右 12px，上下 6px），导致内嵌多行标签时，左右留白是上下的整整两倍，产生强烈的上下贴边、左右空旷的非对称失衡感。

## 变更

- **`ContextChip`（`repo-context-chip.tsx`）**：
  - 新建复用组件，统一管理集合与话题标签的呈现逻辑；
  - 集合徽章使用 Lucide 精致矢量图标 `FolderIcon`（`size-3`），技术话题保持纯净纯文本形态；
  - 均沿用经典 `variant="secondary"` 统一样式，维持克制统一的设计系统语言；
  - 显式声明 `leading-none`，消除文字垂直行高空隙。
- **`RepoCard` 与 `RepoTable`（`repo-card.tsx`、`repo-table.tsx`）**：
  - 统一引入 `ContextChip`，替换原有各自内联的旧实现；
  - 折叠徽章统一固定高度 `h-[22px]`，文本与徽章均设置 `leading-none`。
- **`OverflowChipRow`（`overflow-chip-row.tsx`）**：
  - 将所有标签外层包装容器改为 `inline-flex shrink-0 items-center`，消除 inline baseline 导致的徽章垂直位移；
  - `TooltipContent` 显式设置 `p-2`，覆盖默认的 `px-3 py-1.5`，使浮层四周达到绝对匀称的 8px 间距，与标签之间的 6px 间距（`gap-1.5`）形成和谐呼吸感；
  - Tooltip 内折叠标签包装项同步设为 `inline-flex shrink-0 items-center`，保证浮层内图标与文本同样物理对齐。
- **单测覆盖（`repo-context-chip.test.tsx`、`repo-card.test.tsx`）**：
  - 补充 `ContextChip` 渲染集合（含图标）与话题（纯文本）的独立单测；
  - 补充 `RepoCard` 渲染集合与话题的集成单测。

## 验收

- 全项目 Biome 代码规范与格式化通过（`pnpm lint`、`pnpm format`）。
- 全项目 TypeScript 类型检查通过（`pnpm typecheck`）。
- 全项目 57 个测试套件共 306 项单测全部通过（`pnpm test`）。
