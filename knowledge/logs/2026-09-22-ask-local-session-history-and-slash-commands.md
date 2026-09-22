# 2026-09-22 · Ask 纯前端历史会话列表与快捷斜杠命令交付（ADR 0048）

## 触发背景
在 Ask Asterism 完成生产环境验收与 Issue #41 关闭后，用户发起探讨「你觉得有没有必要做 LLM 历史会话列表」，并通过 `/grill-me` 进行了方案论证与交互推演。
双方明确：
1. **不做重型全屏 ChatGPT 复制品**：保持 Ask Asterism 底部 Dock 与轻量对话舱形态，不改变轻量检索底色；
2. **纯客户端存储、零服务端负担**：不新增 Supabase 数据表与 RPC，使用浏览器 IndexedDB（优先）+ localStorage（降级兜底）；
3. **7 天智能淘汰与保护机制**：以 7 天作为淘汰周期，引入保底 5 条（休假回归不被全部清空）与上限 30 条（防止客户端膨胀）；
4. **斜杠命令交互**：输入框输入 `/` 呼出轻量浮动指令菜单，提供 `/history` 与 `/new` 两个优雅直观命令；
5. **舱内直接呈现与键盘优先**：历史会话列表在现有气泡舱内切换展示，输入框就地作为搜索过滤框；支持方向键高亮、回车恢复会话、Esc 随时返回当前对话。

## 变更内容

### 1. 架构决策落地（ADR 0048）
- 新增 `knowledge/decisions/0048-ask-local-session-history-and-slash-commands.md`，规范数据结构、存储选型、淘汰算法、UI 容器定位与键盘可访问性规范。

### 2. 本地持久化与老化淘汰引擎
- `apps/web/src/lib/ask-session-storage.ts`：
  - 定义 `AskSessionRecord`（id、title、createdAt、updatedAt、turns）；
  - 实现 IndexedDB 异步读写与版本迁移，在沙盒/隐私模式下无缝回退至 localStorage；
  - `applySessionEviction` 算法：按更新时间倒序，保留 7 天内记录；若符合条件的不足 5 条，按时间倒序保底保留最多 5 条；若超过 30 条，严格按时间截断至 30 条；
  - `formatSessionTitle`：截取首问有效提问并规范化标题；
  - `clearAllAskSessions` 与 `deleteAskSession` 清理与单条删除支持。
- `apps/web/src/lib/ask-session-storage.test.ts`：
  - 8 项单测覆盖保存、读取、更新、淘汰保底/超限规则、首问标题生成与清空。

### 3. 会话状态管理与续接集成
- `apps/web/src/data/use-ask-question.ts`：
  - 暴露 `sessions`、`currentSessionId`、`startNewSession`、`loadSession`、`deleteSession`、`clearAllSessions` 与 `refreshSessions`；
  - `appendTurnAndPersist`：在每次问答轮次产生或续接完成时，自动 upsert 当前会话记录并刷新会话列表；
  - `loadSession`：加载历史会话时恢复所有 turns、计算并对齐自增 ID 偏移，允许用户接着历史话题继续追问。
- `apps/web/src/data/use-ask-question.test.tsx`：
  - 扩充测试用例，验证问答成功后自动持久化与 `startNewSession` 重置行为。

### 4. UI 组件与交互呈现
- `apps/web/src/components/ask/ask-slash-menu.tsx`：
  - 输入框输入 `/` 时在输入框上方轻量浮出毛玻璃斜杠命令菜单；
  - 包含 `/history`（历史会话）与 `/new`（新对话）；
  - 支持键盘 `ArrowUp` / `ArrowDown` 循环移动高亮，`Enter` 选中触发，`Escape` 隐藏。
- `apps/web/src/components/ask/ask-history-view.tsx`：
  - 气泡舱内嵌历史列表卡片，采用 Liquid Glass 晶莹液态毛玻璃与石墨主题色；
  - 顶部展示历史数量统计、返回按钮以及带二次确认的「清空全部」危险操作；
  - 列表项展示会话标题、相对时间（`刚刚`、`5 分钟前`、`昨天`等）、问答轮数与推荐仓库统计徽章，当前活跃会话带有高亮 Accent 标记；
  - 悬停浮现单条删除图标；支持空状态与无匹配搜索结果状态。
- `apps/web/src/components/ask/ask-panel.tsx`：
  - 新增 `dockView: 'chat' | 'history'` 双视图切换；
  - 历史视图下，底部胶囊输入框无缝转变为搜索过滤框（占位符自适应为「搜索历史会话…」）；
  - 深度打通快捷键：输入框在 `/` 菜单打开时劫持上下键与回车；在历史视图时上下键滚动会话项、回车直接加载会话并切回对话、Esc 返回对话。

### 5. 双语国际化与预览环境
- `apps/web/src/i18n/locales/zh-CN.json` & `en.json`：
  - 补齐 commands（`/history`、`/new` 文案与描述）、history（搜索占位、相对时间、计数复数形式、清空确认、空状态文案）；
- `apps/web/src/pages/ask-preview.tsx`：
  - 在 fixture 中注入模拟会话数据，方便本地预览不同阶段下的会话与命令交互。

## 验证情况
- 全库测试：`pnpm test` 全部 54 个测试套件、294 项单元测试 100% 通过；
- 代码质量：`pnpm biome check .` 0 错误、0 警告；
- 类型检查：`pnpm typecheck` 全部 8 个 package 全绿；
- 生产构建：`pnpm build` 全流程通过无阻断。
