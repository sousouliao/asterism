# Browse filter toolbar trigger geometry

## Context

Browse 筛选栏同一行内的 trigger 各写各的样式，导致同一组控件几何互相不一致：

- facet picker 用 `min-w-28 max-w-44` + `justify-between`，宽 112px。
- “更多筛选” 复用同一宽度但保留 Button 的居中排布，且没有尾部箭头，文字挤在盒子中间，与相邻 trigger 的左侧文案基线也不对齐。
- 排序 Select 用 `min-w-40`（164px）、12px 内边距与 8px 间距，并把图标、文案、箭头当作三个 `justify-between` 子项摊到两端，实测图标与文案之间出现大片空白。

同时排序控件在 bulk selection 改造中被并入左侧筛选组，偏离了 `ui-ux.md` 与 `logs/2026-07-14-open-filter-toolbar.md` 记录的「排序独立靠右」信息架构。集合多选 trigger 的计数徽标插在文案与箭头之间，同样会被摊开。

## Changes

- 新增 `apps/web/src/components/filter-trigger.ts`，把筛选栏 trigger 的几何收敛为一份常量：`size="sm"` 高度、`rounded-lg`、10px 水平内边距、6px 内部间距、`min-w-28`/`max-w-44` 宽度区间、`text-caption` 字号，以及图标与尾部箭头的 `--muted-foreground` 用法；不再出现 Select 与 Button 尺寸差。
- facet picker、集合多选、“更多筛选” 与排序四处共用该常量；文案改为 `min-w-0 flex-1 truncate text-start`，尾部计数徽标与箭头因固定贴右边缘。集合与“更多筛选”的计数徽标统一为同一 `Badge`，不再一处用 span 一处用 Badge。
- “更多筛选” 补回尾部箭头；排序改用 Radix `SelectValue`，其 className 会被 Radix 丢弃（v2.3.x 实测），弹性由外层 span 承担。
- 排序控件移回独立右侧组（`sm:ml-auto`），与批量入口同组；筛选控件改为工具栏的直接子项，使窄屏按控件换行，而不是先撑满组宽再整体换行。
- 排序 combobox 补 `aria-label`（此前可访问名只有当前值）。
- 新增 `apps/web/src/components/repo-filter-bar.test.tsx` 锁住共享几何、尾部affordance 位置、分组与可访问名。

## Verification

- 真实 dev server 实测（1440 / 768 / 640 / 620 / 600 / 414 / 390 / 360 / 320）：四个 trigger 在中文下同为 112–114px、英文下按内容取宽（112/112/128/156），高度 32px、内边距 10px、gap 6px 一致；任一宽度无横向溢出；390px 起两行、620px 起单行。
- Light / Dark × zh-CN / en 视觉检查，含 hover、active（facet active、计数徽标、清除按钮）、更多筛选父子浮层、集合多选（本地临时注入集合数据，未写入远端）与键盘焦点态。
- 容器几何与 `2026-07-14` 记录一致：排序独立右侧组，与筛选组由空间而非边框区分。
- Impeccable detector、`pnpm lint`、`pnpm typecheck`、`pnpm test`（web 198 / db 41）、`pnpm build` 通过。
