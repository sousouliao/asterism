# Repo table activity cell rhythm

## Context

Browse 列表视图的「动态」列每行承载两条事实（`更新于 3周前` / `收藏于 3周前`），实测两条 11px / 14px 行高的文字直接相邻：第一行 y=260、第二行 y=274，行间为 0，整块看起来被压在一起。

单元格本身是 `flex flex-col justify-center`，两条 `ActivityValue` 之间没有任何间距；64px 行高里的 28px 内容全部贴在中间，视觉上比实际更拥挤。

## Changes

- 动态单元格补 `gap-y-1`（4px，落在 4px 栅格上），两行之间留出呼吸空间；字号 / 行高沿用 micro token（11px / 14px）不变。
- 实测 0 / 2 / 4 / 6px 四档截图对比后取 4px：0 两侧字贴在一起，6 在 64px 行里开始显得两行分离、不成组。
- 合约 Repo List Pattern 的 Activity 条目补充行间距要求，避免后续又被当成“紧凑元数据”压回去。

## Verification

- 桌面 1440 宽：行高仍为 64px，两行 y=258 / 276（行间 4px），列宽与表头对齐不变。
- Light / Dark 与 390px 移动布局（两行右对齐）视觉检查。
- `pnpm lint` / `pnpm typecheck` / `repo-table.test.tsx` 通过。
