# 2026-09-29 · Ask 底部输入区未配置 Key 体验优化与意图优先流式承接（方案 B 落地）

## 触发背景

在 Ask Asterism 底部输入胶囊中，用户走查反馈：首次访问或未配置 Provider Key 时，输入框上方会突兀地弹出一个巨大卡片浮层（`Ask needs a provider key`），遮挡了下方星标卡片的主工作流，显得冗余生硬。用户提出明确设计诉求：“我觉得未配置 key 的时候，应该直接在输入框里提示，而不是弹出来一个层来展示，但是如何在输入框里展示需要好好认真设计一下”。

## 根因定位与设计重构

1. **根因**：原 `AskDockContent` 将 `hasThread` 硬编码为 `!ask.configured ? true : ...`，导致首屏即便未提问、没有任何会话，也强制展开上方浮层渲染 `AskSetupView`，违背了 `ui-ux.md` 契约中关于“未提问时仅渲染独立的 pill composer，绝不遮挡主内容区”的原则。
2. **重构范式（方案 B：意图优先 · 提交时流式承接）**：
   - **平时静默态（Idle & Unconfigured）**：
     - 未提问且未配置 Key 时，上方**绝对不展开**任何多余图层，保持纯净通透的 48px Graphite Glass 胶囊；
     - 胶囊 Placeholder 保持纯净统一的 `“Ask Asterism…”`，避免冗长文案在胶囊内截断与杂乱；
     - 胶囊右侧紧凑药丸按钮注入微型 `SettingsIcon`，清晰表明 `[ ⚙️ 配置模型 ]` 操作入口。
   - **交互提交态（On Submit · Needs Setup Phase）**：
     - 允许用户正常聚焦并输入问题，按下 Enter 提交；
     - `useAskQuestion` 识别无 `byok`，进入清晰语义的 `needs_setup` 状态：`{ kind: 'needs_setup', question }`；
     - 对话气泡向上自然平滑生长，用户提问气泡正常挂在右侧，左侧 Asterism 气泡以助手卡片优雅承接并提示未配置 Key，附带一键前往设置；
     - 当配置好 Key 后返回，该气泡内按钮自动演进为 `[ ✨ 立即提问 ]`，点击直接重试当前问题开始生成回答。

## 变更明细

- `apps/web/src/data/use-ask-question.ts`：
  - `AskPhase` 联合类型新增 `{ kind: 'needs_setup'; question: string }`；
  - `ask` 函数在检测到 `!byok` 时，取消在途任务并直接置入 `needs_setup` phase，保留用户提问文本。
- `apps/web/src/components/ask/ask-panel.tsx`：
  - `hasThread` 判定移除 `ask.configured` 的强制展开：`dockView === 'history' ? true : ask.turns.length > 0 || ask.phase.kind !== 'idle'`；
  - 彻底移除独立的 `AskSetupView` 遮挡层，全面收敛至统一的 `AskThread` 体系；
  - `AskPendingView` 补齐 `needs_setup` 渲染逻辑：左侧 Asterism 气泡内展示配置引导卡片，未配置时提供 `[ 打开设置 ]`，配置后提供 `[ 立即提问 ]`；
  - 输入框 Placeholder 保持标准统一的 `Ask Asterism…`；
  - 右侧模型配置按钮增加微型 `SettingsIcon`，优化点击交互。
- `apps/web/src/i18n/locales/zh-CN.json` & `en.json`：
  - 新增双语词条 `submitNow`。
- `apps/web/src/pages/ask-preview.tsx`：
  - 预览夹具增加 `needs setup · turn` 与 `idle · unconfigured` 状态。
- 测试用例：
  - `apps/web/src/data/use-ask-question.test.tsx` 增加未配置 key 时调用 `ask` 触发 `needs_setup` 的断言；
  - `apps/web/src/components/ask/ask-panel.test.tsx` 增加静默态无遮挡、右侧设置按钮导航、`needs_setup` 提问气泡与 `submitNow` 按钮的完整断言。

## 验证结果

- 单元测试：`pnpm --filter @asterism/web test` 55 套件、299 项测试 100% 通过；
- 类型检查：8 包 `pnpm typecheck` 全部通过；
- 代码风格：`pnpm lint`（Biome）0 错误。
