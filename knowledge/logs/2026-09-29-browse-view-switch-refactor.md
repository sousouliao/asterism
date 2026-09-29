# 2026-09-29 · Browse 宫格与列表视图切换系统性重构与体验优化

## 背景

Browse 页面在宫格（Grid）与列表（Table / List）切换时存在多重体验断点与潜在缺陷：
1. **隐藏态测量毒化与布局跳动（CLS）**：`BrowseRepoList` 此前采用常驻挂载配合 `hidden`（`display: none`）策略，导致后台隐藏视图的 `clientWidth` 突变为 0，毒化了 `useColumns`（强行退化为 1 列）与 `useTableLayout`（强行退化为移动端 104px 单列，表头消失）。切回视图时首帧严重变形闪烁，且隐藏态下触发重测会把虚拟行高测量污染为 0。
2. **越界反查打破隔离**：`RepoTable` 在 `scrollElement` 为 `null` 时通过 `findScrollParent` 强行越界反查恢复外层滚动容器，导致后台隐藏视图持续响应滚动事件并执行无意义的虚拟计算。
3. **滚动位置生硬归零**：`BrowsePage` 中强行在 `view` 切换时执行 `repoScrollElement.scrollTop = 0`，打断用户的浏览进度与阅读上下文。
4. **双重 rAF 迟滞感**：`useBrowseView` 遗留的双重 `requestAnimationFrame` 导致按钮滑块已到位、内容在 30~50ms 之后才开始提交，交互跟手度差。

## 变更

- **`BrowseRepoList`（`browse-repo-list.tsx`）**：
  - 彻底移除 `mountedViews` 集合与 `hidden` 容器，改为干净直接的单视图按需挂载；
  - 消除双倍 DOM 挂载开销与零尺寸毒化。
- **`RepoCollection`（`repo-collection.tsx`）与 `useColumns`**：
  - `useColumns` 首帧根据 `window.innerWidth` 智能赋初值（宽屏 3 列、平板 2 列、窄屏 1 列），消除桌面端首帧跳变；
  - 增加 `width <= 0` 保护，防止非法尺寸更新列数。
- **`RepoTable`（`repo-table.tsx`）与 `useTableLayout`**：
  - `useTableLayout` 首帧根据 `window.innerWidth` 赋初值（宽屏默认 `'wide'`），消除桌面端挂载时“移动端单列卡片闪烁”；
  - 增加 `width <= 0` 保护；
  - `scrollElement` 显式判断 `!== undefined`，严格尊重外部传入，不随意越界反查。
- **`useBrowseView`（`use-browse-view.ts`）**：
  - 移除多余的双重 `requestAnimationFrame` 定时器与 ref 追踪；
  - 直接通过 React `startTransition` 提交视图变更，保证滑块即时响应、内容非阻塞平滑流转。
- **`BrowsePage`（`browse.tsx`）**：
  - 移除切换视图时强行重置 `scrollTop = 0` 的 effect；
  - 移除已无必要的 `skipViewScrollResetRef`；
  - 保留用户自然滚动位置，与选中的 Quick Look 仓库自动对齐。

## 验收

- 全项目 Biome 代码规范与格式化通过（`pnpm lint`）。
- 全项目 TypeScript 类型检查通过（`pnpm typecheck`）。
- 全项目 56 个测试套件共 303 项单测全部通过（`pnpm test`）。
- 全项目生产环境编译打包通过（`pnpm build`）。
