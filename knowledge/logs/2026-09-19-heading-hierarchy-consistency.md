# 2026-09-19 · 页面标题层级与版面宽度一致性修复

## 目标

用户反馈各页面大标题 / 二级标题字号不统一、版面宽度疑似不统一。审查全部页面标题与容器实现，统一到 ui-ux 契约的既有 token，不新增任何字号或间距值。

## 审查结论

1. **大标题**：`PageHeader` 组件已提供 page（24px/Bold）与 section（20px/SemiBold）两档，但 Browse 页头独用 section 档，与其余页面（24px）形成跨页不一致；Login 主标题使用 `text-4xl / lg:text-5xl`（36/48px）原始档位，偏离契约 `--text-display`（28px）。
2. **二级标题**：Dashboard 记忆唤醒已用 `text-section-title`（20px），但 Settings「外观 / 搜索 / 账号」与导入导出「导出数据 / 导入数据」使用非契约的 `text-base`（16px）；Dashboard 图表卡片标题为 16px **Medium**，与其余卡片标题（16px SemiBold）字重不一致。
3. **版面宽度**：全部 authenticated 页面均为外层 `-m-6 overflow-y-auto px-6` + 内层 `mx-auto max-w-6xl`，与契约 § Scrollbar 一致，**代码层无宽度分叉**；截图观感差异来自截图窗口宽度不同与各页内容密度不同。README 工作区 76.5rem 为契约规定的独立表面，不适用 6xl。
4. **骨架屏**：Settings 路由骨架用 20px 标题档（实际标题 24px）、Browse 工具栏骨架 20px、导入导出面板块 16px，与真实内容不镜像。

## 变更

确立三级标题层级（全部既有 token）：

| 层级 | Token | 覆盖 |
| --- | --- | --- |
| 页面标题 h1 | `--text-page-title` 24px/Bold（Login 用 `--text-display` 28px） | Browse / Dashboard / Collections / 集合详情 / Settings / 导入导出 / Login |
| 区块标题 h2 | `--text-section-title` 20px/SemiBold | Settings 分区、Dashboard 记忆唤醒、导入导出双面板、空状态 |
| 卡片 / 面板标题 | `--text-drawer-title` 16px/SemiBold | 集合卡片名、Dashboard 图表卡片标题（字重由 Medium 统一为 SemiBold） |

- `apps/web/src/components/page-header.tsx`：删除 `size` prop 与 section 分支，页头只保留 page 档。
- `apps/web/src/pages/browse.tsx`：两处 `PageHeader` 移除 `size="section"`。
- `apps/web/src/pages/settings.tsx`、`import-export.tsx`：区块 h2 `text-base` → `text-section-title`。
- `apps/web/src/pages/collections.tsx`：卡片名 h2 → `text-drawer-title`。
- `apps/web/src/components/dashboard/dashboard-charts.tsx`：CardTitle `font-medium text-base` → `font-semibold text-drawer-title`。
- `apps/web/src/pages/login.tsx`：h1 → `text-display`（契约 28px），h2 `text-[28px]` Bold → `text-section-title` SemiBold，消除同级同字号。
- `apps/web/src/components/page-loading-states.tsx`：删除 `compact`；Browse / Settings / 导入导出骨架标题高度镜像新字号（24px 标题 h-6、20px 区块 h-5）。
- `knowledge/contracts/ui-ux.md`：Typography 表更新用途映射（page-title 覆盖所有页面 h1；section-title 去掉「Browse 页头」；drawer-title 扩为「Drawer / Dialog 与内容卡片标题」），并新增三级层级与骨架镜像的规范句。

## 验证

- `pnpm --filter @asterism/web typecheck` 通过。
- `pnpm --filter @asterism/web test`：42 文件 / 206 测试全部通过。
- `npx biome check`（8 个改动文件）无问题。
- 静态 sweep：全仓 h1/h2 无 `text-base` / `text-*xl` / 裸 px 值充当标题；剩余 `text-base` 仅侧栏品牌名与 Login 副正文（非标题，属正文范畴）。
- 浏览器视觉验证由维护者自行执行（本次约定不启动浏览器）。

## 决策说明

Browse 页头从 section-title 提升为 page-title 修订了 ADR 0007 时代的用途映射（token 值本身不变），依据是用户明确的跨页一致性诉求与「Browse 页头是页面唯一 h1」的层级事实；已同步契约而非留下代码 / 契约分叉。不新增 ADR（无 token 值或架构变化）。

## 追加：滚动条槽位造成的版面偏移修复

用户复测发现「页面有滚动条时会偏移一点点」。根因：Windows / Linux 经典滚动条占布局宽度（自定义滚动条 8px），滚动条只在内容溢出时出现，导致三类位移——滚动页与不滚动页内容盒差 8px（居中列横移 4px）、滚动条出现 / 消失时内容跳动、Browse 吸顶区（不滚动）与列表（滚动）错位 4px。

方案：`scrollbar-gutter: stable` 常驻预留，全部落在既有结构上：

- `packages/ui/src/styles/globals.css` 新增 `@layer components` 语义类 `.asterism-scroll-gutter`。
- 应用到全部全宽滚动层：六个页面根 + Browse 列表 / 空态根 / 加载内容块 + README 工作区 + resurface-preview；路由 fallback（`LoadingFrame`、`SettingsRouteLoading`）重构为与页面根相同的 `-m-6 + gutter + px-6` 外层与 `mx-auto max-w-6xl` 内层，消除加载→完成位移。
- Browse 固定头与批量选择栏不能加 `overflow` 裁剪（GlassControlRow 的 100vw 吸顶背景渐隐会被裁掉），改用 `pr-[calc(var(--scrollbar-size)_+_1.5rem)]` 补齐同样槽位，使吸顶区、列表、底部操作栏三者内容盒一致。
- 契约 § Scrollbar 新增「滚动条槽位常驻预留」规则段；macOS 覆盖式滚动条下 `scrollbar-gutter` 自然退化为无操作。

验证：typecheck、42 文件 / 206 测试、Biome（含 `packages/ui` CSS）全部通过；浏览器视觉验证由维护者执行。
