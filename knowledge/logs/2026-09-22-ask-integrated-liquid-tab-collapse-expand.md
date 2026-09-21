# 2026-09-22 · Ask 对话展开收起重构与一体化上凸液态拉手（方案三落地）

## 触发背景
在 Ask Asterism 升级为双侧气泡和右侧内容区居中后，用户提出：对话展开时不应该在右上角单独放一个独立的关闭按钮，既破坏氛围又太常规；希望能通过点击空白处和按 Esc 自然收起，收起后在对话框上方有一个优雅的展开提示，并选定“方案三：输入框一体化上凸液态拉手（Integrated Liquid Tab）”。

## 变更内容

### 1. 彻底移除独立关闭按钮
- 移除了原 `section` 右上角的 `button[aria-label="Close"]`，摆脱模态弹窗遗留痕迹。

### 2. 状态机制重塑（从强制 Reset 到可逆 Collapse）
- `apps/web/src/components/ask/ask-panel.tsx`：
  - 引入 `collapsed` 局部状态，计算 `isExpanded = hasThread && !collapsed`；
  - **Click Outside**：全局监听 `pointerdown`，当点击发生在 dock 容器与 Radix 浮层之外时，平滑收起对话；
  - **Esc 键双层逻辑**：
    - 输入框有文字时按 Esc：优先清空输入框；
    - 输入框无文字且会话展开时按 Esc：收起对话面板（保留对话 turns 上下文）；
    - 已处于收起状态再次按 Esc：彻底重置清空（`ask.reset()`）；
  - **自动展开**：输入框获得焦点（`onFocus`）、按下全局快捷键（`focusRequest`）、或提交新问题时，自动平滑展开对话。

### 3. 方案三落地：一体化上凸液态拉手（Integrated Liquid Tab）
- **收起状态（`hasThread && collapsed`）**：
  - 在 `form` 输入框顶部正中央无缝拱出微弧形流体毛玻璃拉手；
  - 尺寸：宽 48px、高 16px，`rounded-t-lg border-t border-x border-white/80`，底边开放与输入框上边缘融合；
  - 材质：`bg-gradient-to-b from-white/95 via-white/90 to-white/80 backdrop-blur-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.95)]`（暗色自适应）；
  - 动效：内嵌向上微光箭头 `ChevronUpIcon`，悬停时带有向上 1.5px 的指引位移动效，点击展开对话；
- **展开状态（`hasThread && isExpanded`）**：
  - 在输入框顶部中央提供微弱半透明向下折叠指示拉手（`ChevronDownIcon`），点击亦可收起对话。

### 4. 国际化与单测
- `apps/web/src/i18n/locales/zh-CN.json` 与 `en.json`：新增 `expandThread`、`collapseThread`、`resetThread`；
- `apps/web/src/components/ask/ask-panel.test.tsx`：全面升级为断言一体化拉手的收起/重新展开以及 Esc 两段式收起与重置。

## 验证情况
- 单元测试：`pnpm --filter @asterism/web test src/components/ask/ask-panel.test.tsx` 11/11 全通；
- 全库测试：`pnpm test` 52 个文件、272 项测试全部通过；
- 代码质量：`pnpm lint` 351 文件 0 错误；
- 类型检查：`pnpm typecheck` 8 个包全部通过。
