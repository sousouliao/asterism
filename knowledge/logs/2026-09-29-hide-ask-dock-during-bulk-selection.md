# 2026-09-29 · 批量选择模式下隐藏 Ask 对话框避免底部浮层重叠

## 背景与问题

当用户在 Browse（浏览）页面进入「批量操作」模式时，底部会升起常驻的 `BulkSelectionBar` 操作栏（包含已选数量、全选、整理、导出、完成等按钮）。
同时，页面常驻的 `AskDock`（Ask Asterism 底部输入胶囊/问答对话舱）同样定位于底部中央偏右区域（`fixed bottom-0 lg:left-60`），导致 AskDock 直接覆盖在 BulkSelectionBar 上方，遮挡了整理按钮和计数器，造成明显的界面重叠与操作死区。

## 解决与重构方案

1. **共享批量选择状态 (`useBulkSelectionStore`)**：
   - 在 `apps/web/src/stores/bulk-selection.ts` 中创建 Zustand store，统一管理 `active` 批量选择状态；
   - 在 `apps/web/src/pages/browse.tsx` 中接入该 store，并在组件卸载时自动重置 `setActive(false)`。
2. **条件隐藏 Ask 对话舱 (`AskDockContent`)**：
   - 在 `apps/web/src/components/ask/ask-panel.tsx` 中订阅 `useBulkSelectionStore`；
   - 当 `active` 为 true 时，为 `div[data-ask-dock]` 赋予 `hidden` 类名（`display: none`）；
   - 对话舱的 DOM、背景流体氛围层、展开的回答及底部输入框完全隐藏，不遮挡任何批量操作元素；
   - 退出批量选择模式时自动无缝恢复，且不会破坏用户之前正在编辑的草稿或对话状态。
3. **快捷键冲突隔离 (`AppLayout`)**：
   - 在 `apps/web/src/layouts/app-layout.tsx` 中监听快捷键 `⌘K` / `Ctrl+K` 时，若处于批量选择激活态则直接忽略，避免快捷键产生意外交互。
4. **单测保障**：
   - 在 `apps/web/src/stores/bulk-selection.test.ts` 增加状态切换单测；
   - 在 `apps/web/src/components/ask/ask-panel.test.tsx` 增加批量选择下 `AskDock` 隐藏与恢复测试。

## 验证

- `pnpm --filter @asterism/web test`：通过（24 个测试套件，127 个测试全部通过）。
- `pnpm test`：全工程测试全部通过（56 个测试套件，303 项测试全部通过）。
- `pnpm lint`：Biome 零报错。
