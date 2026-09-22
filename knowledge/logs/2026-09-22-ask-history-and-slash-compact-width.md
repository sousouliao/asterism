# 2026-09-22 · Ask 历史会话与斜杠命令紧凑等宽对齐收敛

## 触发背景

在 Ask Asterism 引入分层响应式宽度（未激活胶囊 `max-w-xl xl:max-w-2xl`，展开态 `max-w-2xl xl:max-w-3xl`）与 ADR 0048 历史会话体系后，用户走查反馈：从输入框敲入 `/` 唤起命令面板，再回车进入 `/history` 历史会话列表时，面板与输入框突然从紧凑态拉宽到 768px；按 Esc 退出又缩回 576px。用户提出明确诉求：“那也应该是展开会话时才变宽吧，而不是从命令面板进入历史会话面板就变宽”。

## 根因定位与收敛策略

1. **根因**：原代码在 `hasThread` 判定中将 `dockView === 'history'` 无差别判定为 `true`，导致外层容器直接应用展开宽态 `max-w-2xl xl:max-w-3xl`；
2. **心智澄清**：
   - **索引选择态（紧凑专注，576px / 672px）**：输入胶囊、斜杠命令面板（`AskSlashMenu`）、历史会话列表（`AskHistoryView`）。三者同为索引、过滤与选择器，无横向重排卡片，保持完全等宽；
   - **会话展开态（舒展阅读，672px / 768px）**：仅在载入或提问进入真正的对话流（`dockView === 'chat' && isExpanded && !isSlashOpen`）时才舒展变宽，满足单行 65~80 字符与 `AskRecommendationCard` 多徽章排版。

## 变更明细

- `apps/web/src/components/ask/ask-panel.tsx`：
  - 新增 `isChatExpanded = dockView === 'chat' && isExpanded && !isSlashOpen`；
  - 容器宽度条件由 `isExpanded && !isSlashOpen ? ...` 收敛为 `isChatExpanded ? 'max-w-2xl xl:max-w-3xl' : 'max-w-xl xl:max-w-2xl'`；
  - 移除会话流容器上的 `.asterism-scroll-gutter`，添加 `[scrollbar-width:none] [&::-webkit-scrollbar]:hidden` 彻底隐藏原生灰色滚动条，保障手势滚动的无缝纯净；
  - 重构 `AskAnswerBubble`（Agent 回答气泡）：边框升级为 `border border-black/[0.08] dark:border-white/[0.14]`，叠加顶部 1px 晶莹高光 `shadow-[inset_0_1px_1.5px_rgba(255,255,255,1)]`，底色提纯为冷白玉水润渐变，彻底解决白底融化、边界看不清的问题，与底部输入胶囊保持 100% 材质血统一致。
- `apps/web/src/components/ask/ask-recommendation-card.tsx`：
  - 强化推荐仓库卡片悬停交互：hover 状态升级为星标蓝边框 `hover:border-primary/60` 与冰晶微蓝渐变底色 `hover:bg-primary/[0.04]`，叠加 1px 晶莹高光 `hover:shadow-[inset_0_1px_1.5px_rgba(255,255,255,1)]`，并显式追加 `cursor-pointer`；彻底解决浅色白底气泡内悬停反馈不明显的问题，鼠标划过时呈现晶莹剔透的激活反馈。
- `apps/web/src/components/ask/ask-slash-menu.tsx`：
  - 彻底解决命令菜单“太白了”与“选中态实心蓝块粗暴突兀”的痛点；
  - 外壳由死板的 `bg-white/88` 调降为清透水润的 `bg-white/75 backdrop-blur-2xl`，搭配石墨发丝微暗边框 `border-black/[0.08]`，彻底移除外部大阴影；
  - 废弃左侧刺眼的实心深蓝大色块（`bg-primary text-white`），升级为精致半透明微胶囊（`border-primary/30 bg-primary/15 text-primary`）；
  - 选中态转变为**整行泛起清润的星标冰蓝微光（`bg-primary/[0.07]`）**，标题联动加粗变色，形成高度和谐、雅致的整行激活反馈。
- `apps/web/src/components/ask/ask-history-view.tsx`：
  - **一体化 Liquid Glass 舱体重塑**：废弃原先散碎的外部顶栏 + 浮岛卡片嵌套结构，重构为与 `AskSlashMenu` 完全对称的一体化毛玻璃视窗（`bg-white/75 dark:bg-[#131A24]/85 backdrop-blur-2xl border-black/[0.08]`），顶栏作为视窗内首行柔和分区；
  - **彻底去除外部黑色投影**：废除所有外部弥散阴影（`0_8px_20px_-4px_rgba(15,23,42,0.1)` 等）与实体上浮（`-translate-y-0.5`），全面回归 Apple 级顶部纯内折射光效；
  - **信息密度与排版大幅优化**：
    1. **标题首字左平齐**：将原先挤在标题前面的 `[当前会话]` 实心绿/蓝徽章移至标题文本后方（尾置精致微胶囊），保证所有历史标题纵向视线对齐零跳动；
    2. **删除视觉噪音毛刺**：清理时钟图标、小圆点、绿灯闪烁、无业务增量的单轮指标（`1 轮` 仅在 >1 轮多轮对话时才展示），彻底摆脱条目拥挤不堪的视觉混乱；
    3. **双行极简扫描结构**：主行呈现会话标题 + [当前] 标识，副行呈现「相对时间 · 推荐数量 · 轮数」，使用中文居中间隔点优雅串联；
    4. **整行冰蓝微光交互**：条目 hover 与键盘上下移动高亮时，泛起通透的星标冰蓝（`bg-primary/[0.07] border-primary/25`），彻底消除多重边框嵌套感；
  - **彻底去除生硬内嵌分割线并统一对齐边距**：去除顶栏底部的 `border-b`，避免两端截断悬空与外框圆角产生的视觉边距不对称；容器 padding 统一定为 `p-1.5`，列表项与顶栏实现无缝共轴垂直对齐；
  - 隐藏历史会话列表容器的原生滚动条（`[scrollbar-width:none] [&::-webkit-scrollbar]:hidden`）。
- `apps/web/src/components/ask/ask-panel.test.tsx`：
  - 增加历史会话视图下容器保持 `max-w-xl xl:max-w-2xl` 的自动化回归断言。
- `knowledge/contracts/ui-ux.md`：
  - 更新「分层响应式宽度体系」与「气泡交错节奏与材质」契约，固化隐藏滚动条与石墨发丝微暗描边规范。

## 验证结果

- 测试套件：全库 54 套件、294 项单元测试 100% 通过（`pnpm test`）；
- 类型检查：8 包 `pnpm typecheck` 全部通过；
- 代码风格：360 文件 `pnpm lint`（Biome）0 错误 0 警告。
