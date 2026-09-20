# 2026-09-20 · Ask 常驻底部输入区

## 背景

用户澄清交互语义：Ask Asterism 不应该是快捷键 / 顶栏按钮唤起的弹层，而是页面底部直接可见并可输入的区域；
快捷键只用于聚焦 composer，不再用于打开面板。

## 变更

- `AskPanel`（Radix Dialog 承载）改为 `AskDock`：App Shell 内常驻、非模态的底部输入区。
- 问答流仍从 composer 上方生长并贴底滚动；未提问时只显示 composer 与空态提示。
- ⌘K / Ctrl K 改为聚焦 composer；顶栏 Ask 按钮移除。
- dev 预览与测试同步改为注入 `AskDockContent`，测试断言仍覆盖未配置 key、提交、回答渲染、进行中与错误分支。
- 同步 `knowledge/contracts/product.md` 与 `knowledge/contracts/ui-ux.md` 的 Ask 交互描述。

## 验证

- `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build` 全绿。
- `/dev/ask-preview` 视觉检查：answered 状态与 idle 状态的底部输入区布局正常。
- 相邻问题（未修改）：Ask 推荐卡内 tooltip trigger 仍存在 button 嵌套 button 的测试告警。
