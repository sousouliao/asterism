# 2026-09-23 · 记忆唤醒卡片标题与收藏时间垂直对齐修复

针对记忆唤醒卡片（`ResurfaceCard`）首行中左侧仓库名称与右侧相对收藏时间文字基线错位问题进行精确定位与修复：

1. **问题根因**：
   - 外部 flex 容器此前采用 `items-start`（顶端对齐）；
   - 左侧仓库名称字号为 `text-body`（14px，行高 20px / `leading-5`）；
   - 右侧相对时间字号为 `text-caption`（12px，默认行高 16px / `leading-4`）；
   - 顶边贴齐导致右侧 12px 文本盒高仅 16px，其文字底边基线（baseline）距离顶部仅约 12px，比左侧 14px 文本基线（约 15px）高出了整整 3px，产生明显的“悬空上浮”视觉落差。
2. **修复落地**：
   - 将 `ResurfaceCard` 首行 flex 容器从 `items-start` 调整为 `items-center`；
   - 为右侧时间文本补充 `leading-5`（20px），使左右两端在统一的 20px 盒模型内居中对齐，中轴完全重合，文字基线落差归零至亚像素级；
   - 兼容已归档（`Badge`）与超长仓库名截断（`truncate`）场景。

本地验证：
- Geist Variable 真实字体与 headless Chrome 渲染对比测试，基线完全平齐；
- `pnpm lint`（Biome）全仓通过；
- `pnpm --filter @asterism/web test` 54 套件、294 项测试全部通过。
