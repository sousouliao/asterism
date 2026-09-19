# 2026-09-20 · UI Generation 日志 · Ask Asterism 面板与配置区

## 目标组件

GitHub #41 的 UI 切片：顶栏 Ask 入口 + Command Palette 式问答弹层（含全状态机与推荐卡片）、
Settings 的 Ask BYOK 配置分区（含出网披露同意对话框）。属既有表面内扩展，继承 Graphite Glass。

## 工具与复用

- 未用 v0 / shadcn MCP：全部基于既有 `@asterism/ui` 组件（Dialog、Input、Label、Select、
  Badge、Button、ConfirmDialog）与 `MatchExplanationBadge`、Resurface 卡片解剖直接实现。
- 设计决策走 impeccable 的 Extend existing surface 路径：不新造 token、不新造组件体系；
  Operate 模式纪律（状态完备、无装饰动效、command palette 属标准许可）。

## 迭代与关键修改

共 1 轮修复批（批式截图后）：

- 预览页 `answered` 分区 fixture 结构错误导致空渲染 → 重构 PHASES 携带显式 turns。
- 面板 `invalid_key` 错误只有文案没有去设置的入口 → AskThread/AskPendingView 增加可选
  `onOpenSettings`，key 失效时提供设置按钮（与未配置引导同一去向）。
- 过程性修复：受控输入提交边界 trim、turn 稳定 id（替代数组索引 key）、Dialog portal 测试
  读取 document.body、快捷键提示与 aria-keyshortcuts。

## Gate 结果

- a11y：Dialog 基元（焦点陷阱 / Esc / Tab）+ aria-keyshortcuts + role=status/alert +
  sr-only 标题描述；语言色点 aria-hidden；证据徽章可聚焦可读。
- lint / typecheck：`pnpm lint`、`pnpm typecheck` 全绿（biome 自动修复 format/import 后）。
- 契约一致性：全部使用既有 token（caption/micro 字阶、muted-foreground、border-ring 悬停、
  --ease-out-quart 150ms、玻璃只用于弹层），无新造样式。
- i18n：`ask.*` + `settings.ask*` en / zh-CN 全量外部化，键位奇偶校验测试通过。
- 视觉 review：桌面 1280 亮/暗 + 移动 390 亮三档截图人工核对通过；`detect.mjs` 零发现。
  本 harness 无 shipped finish-reviewer agent，视觉审查以线程内方式完成（如实披露）。

## 成本 / 耗时

UI 相关实现 + 测试 + 截图复核约一小时轮次；无外部付费工具调用。
