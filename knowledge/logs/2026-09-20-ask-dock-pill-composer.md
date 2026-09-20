# 2026-09-20 · Ask 底部输入区胶囊化与空态简化

## 背景

用户反馈底部常驻输入区视觉臃肿：
1. 未提问时常驻展示了上方大白框与空态提示（`emptyHint`），遮挡了主界面的仓库卡片列表；
2. 输入框被外部多层容器嵌套（`section > div.border-t.p-3 > form`），结构多余；
3. 用户期望未提问时仅显示独立的 `rounded-full` 胶囊输入框。

## 变更

1. **空态简化**：未提问状态（`turns.length === 0 && phase.kind === 'idle'` 且已配置）下，彻底移除上方的大白框与 `emptyHint` 提示，不再遮挡页面内容。
2. **输入框胶囊化**：
   - 移除外层包裹的 `div.border-t.p-3` 与嵌套边框；
   - 输入框表单直接呈现为独立的 `rounded-full` 胶囊（pill composer），高度 48px，左右对称内边距；
   - 沿用 Graphite Glass 体系（`border-[var(--glass-border)] bg-[var(--glass-surface-strong)] shadow-[var(--glass-shadow)] backdrop-blur-[16px]`），聚焦时具备双层焦点环微光。
3. **问答流生长体验**：
   - 当产生问答（提问中、已回答、错误）或未配置 key 时，对话面板在输入框正上方以 `rounded-2xl` 独立卡片平滑展开，内部贴底滚动；
   - 消息面板右上角新增轻量关闭按钮（调用 `reset`），支持用户按 `Escape` 快捷收起会话回到极简胶囊状态。
4. **测试与预览同步**：
   - 同步更新 `ask-panel.test.tsx`：断言空态下不含 `emptyHint`，断言表单拥有 `rounded-full`，测试 Escape 与关闭按钮收起逻辑，添加测试间 `afterEach` DOM 清理；
   - `/dev/ask-preview` 支持点击右上角收起各 fixture。

## 验证

- `pnpm lint` 检查通过。
- `pnpm typecheck` 全工作区通过。
- `pnpm --filter @asterism/web test` 全部 51 个文件、271 项单测全绿。
