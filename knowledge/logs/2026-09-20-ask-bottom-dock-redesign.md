# 2026-09-20 · Ask 面板底部对话舱重设计

## 背景

用户要求把 Ask Asterism 的问答弹层从顶部输入式 Command Palette 布局改为对话式底部 dock：
对话框放到底部中间、composer 直接可输入、消息向上逐条弹出、Agent 在左、用户在右。
走 impeccable Extend-existing-surface 路径（Operate 模式），决策经结构化问询确认：
Agent 回答用**无气泡纯文本**（阅读面积最大，与 Graphite Glass 克制基调一致），遮罩**减淡**。

## 变更

- `packages/ui` `DialogContent` 新增可选 `overlayClassName`（透传 `DialogOverlay`），默认行为不变。
- `apps/web` `ask-panel.tsx` 重构为底部 dock：
  - 定位 `top-auto bottom-4 sm:bottom-6`、`max-w-2xl`、`max-h-[min(32rem, calc(100dvh - 6rem))]`，内容随问答生长；
  - composer 移至舱底（玻璃输入条，`focus-within` 描边），打开即聚焦，busy 不再禁用输入（允许预输入下一问）；
  - 用户消息 = 石墨蓝调 `accent` 气泡靠右（`rounded-br-sm` 尾角收窄），回答 = 无气泡纯文本 + 证据卡片靠左；
  - 进行中 / 出错轮次的问题也先入列（`AskLiveTurnView`），与完成轮次同一布局；
  - 新消息入场 `slide-in-from-bottom-2 + fade-in`（200ms / `--ease-out-quart`，`motion-reduce` 关闭）；
  - 遮罩减淡 `bg-black/30`；关闭按钮改为玻璃小按钮（`glass-surface` 材质），消息区 `pt-11` 避让；
  - 消息区 `role="log"` + sr-only 说话人标签（「我」/「Asterism」，双语）。
- 贴底滚动：挂载贴底走 **ref callback**（`attachLog`，instant + rAF 兜底），`useLayoutEffect`
  仅负责后续 `turns/phase` 变化的平滑滚动（reduced-motion 时 auto）。
- `AskPanelContent` 拆出 `AskViewState` 注入缝：生产由 `AskPanelConnected`（打开时才挂载
  `useAskQuestion`）接线，dev 预览可直接注入 fixture。`/dev/ask-preview` 新增
  「bottom dock · real chrome」分区，每个状态都能以真实壳层打开预览。
- i18n：`ask.speakerYou` / `ask.speakerAsterism` 双语键；`AskThread` 静态分区 gap 6→5 对齐 dock 内距。

## 关键发现（React 19.2 StrictMode + Radix Portal）

挂载期 `useEffect` / `useLayoutEffect` 均在 ref 附加**之前**执行（探针证实：effect×2 读到
`scrollRef.current = null`，ref attach/detach/attach 序列在其后）。因此「打开面板即贴底」不能
依赖 effect 里的 ref，必须走 ref callback；effect 只服务挂载完成后的更新滚动。已记入 ui-ux 契约
Ask 对话舱例外条目。

## 迭代修复（视觉验证批内）

1. 右上角默认关闭按钮与用户气泡重叠 → 玻璃小按钮 + `pt-11` 顶部净空。
2. 贴底滚动失效（`scrollTop` 恒 0）→ 探针定位为上述 React 19.2 时序 → ref callback 方案。
3. smooth 滚动在 occluded 视口被冻结 → 挂载改 instant（体验也更正确：打开直接看最新消息）。

## Gate 结果

- `pnpm typecheck`（web + ui）、`pnpm test`（web 253 全过，含新增 in-flight 问题入列用例）、
  `biome check` 全绿。
- 视觉验证（impeccable 有界批式）：1440×900 明 / 暗两主题 × answered / multi-turn / idle /
  needs-setup 状态 + 390×844 窄视口，共 6 张截图逐张检查通过；遮罩、贴底、气泡对齐、
  关闭按钮避让均确认。
- dev 预览：`/dev/ask-preview` 的 dock 分区使用真实 `AskPanelContent`（非复制品），后续状态
  改动可直接在此回归。

## 未尽事项

- `zh-CN` 说话人标签定稿为「我 / Asterism」，如需更正式的「用户」可改 i18n 键。
- 若后续给 dock 增加历史会话持久化，需重新评估「关闭即复位」的挂载/卸载策略。
