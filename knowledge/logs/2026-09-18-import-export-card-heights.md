# Import / Export paired card heights

## Context

导入 / 导出页的两张卡片在同一栅格行里高度不一致：实测 1280 宽下左卡（导出数据，三行格式）407px，右卡（恢复备份，标题 + 说明 + 拖拽区）262px，底部差 145px。

原因不是内容，而是栅格显式写死了 `grid items-start gap-6 md:grid-cols-2`：`items-start` 取消栅格默认的 `stretch`，两张卡各自按内容取高。右卡的拖拽区固定 `min-h-36`（144px），即使允许拉伸，多余高度也只会落成卡片底部的一块空白。

## Changes

- 栅格去掉 `items-start`，恢复 `stretch`：同一行内两张卡等高。
- 拖拽区补 `flex-1`，让右卡多出来的高度由拖拽区吃掉（1280 中文 289px、英文 369px），而不是在卡片底部留下无意义空白。
- 骨架 `ImportExportContentSkeleton` 同步：去掉 `items-start`，占位块改为 `min-h-36 flex-1`，保持骨架与最终内容同构。
- 合约补 `Paired Card Row · 并排卡片行`：并排卡片必须等高、可伸缩区域用 `flex-1` 吃掉剩余高度、单列下不得被压到最小高度以下、骨架镜像同一行为。

## Verification

- 1280 宽：中文 407 / 407（拖拽区 289），英文 507 / 507（拖拽区 369），两语均等高；Dark 同值。
- 390 宽单列：左 571、右 282，拖拽区保持 144px 最小高度，`flex-1` 在无剩余空间时不生效；无横向溢出。
- Light / Dark、zh-CN / en 四组截图检查。
- Impeccable detector、`pnpm lint`、`pnpm typecheck`、`pnpm test`（web 205）通过。
