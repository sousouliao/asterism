# 2026-09-22 · Ask 对话舱右侧内容区居中与分层响应式宽度体系重构

## 触发背景
在 Ask Asterism 升级为双侧气泡与全屏底部渐变羽化 Liquid Glass 之后，在具有左侧边栏（`w-60` 即 240px）的实际桌面主布局下，由于根定位采用绝对全屏 `fixed inset-x-0 bottom-0`，计算的居中点为整屏 50vw，相对于用户视线聚集的右侧内容区向左偏离了 120px，视觉失衡明显；同时对话框与展开对话列表此前单一固定为 `max-w-2xl`，未提问时略显冗长，而提问展开后包含多标签仓库推荐卡片时略显紧促。用户提出将对话框改为右侧内容区居中，并对对话框与对话列表宽度做周全合理的系统梳理。

## 变更内容

### 1. 几何对齐基准重构（Content Area Centering）
- `apps/web/src/components/ask/ask-panel.tsx`：
  - 根节点 `data-ask-dock` 定位由 `fixed inset-x-0 bottom-0` 升级为 `fixed bottom-0 right-0 left-0 lg:left-60`。
  - 背景流体毛玻璃氛围层同样对齐 `fixed bottom-0 right-0 left-0 lg:left-60 -z-10`。
  - **效果**：
    - 窄屏（`<1024px`）：全宽满屏居中；
    - 桌面端（`>=1024px`）：严格在右侧内容工作区（`calc(100vw - 15rem)`）几何居中，输入框、气泡流与仓库卡片网格中轴线完全重合；
    - 保护左侧固定侧边栏的视觉纯净，不受向上渐隐遮罩和中心微冷液态光晕污染。

### 2. 分层自适应宽度体系（Tiered Responsive Width）
- 未提问态（Idle 胶囊）：`max-w-xl xl:max-w-2xl`（576px ~ 672px），如同 Spotlight 般轻巧聚焦，提升主界面透气度；
- 对话展开态（Thread Active 气泡流）：`max-w-2xl xl:max-w-3xl`（672px ~ 768px），展开后平滑拓宽，使 Markdown 正文单行字数处于 65~80 字符的黄金阅读行宽，并使仓库推荐卡片（`AskRecommendationCard`）内的各项匹配 Badge 标签与星标数横向整行舒展，避免挤压折行。

### 3. 气泡比例与错落节奏精调
- 用户问题气泡：`ml-auto max-w-[80%] xl:max-w-[75%]`，自适应字数贴右，为左侧留出充裕负空间；
- 助手回答气泡：`mr-auto w-full max-w-[95%] sm:max-w-[92%]`，贴左展开并在右侧刻意保留 8% 呼吸空隙，形成生动的双向对话张力；
- 纵向滚动区高度：由 `max-h-[min(32rem,calc(100dvh_-_8rem))]` 增加为 `max-h-[min(36rem,calc(100dvh_-_8.5rem))]`，多出 4rem 纵向沉浸阅读空间。

### 4. 契约同步
- `knowledge/contracts/ui-ux.md`：新增「Ask Dock Pattern · 问答对话舱模式」章节，完整固化主内容区对齐、Liquid Glass 材质、分层响应式宽度体系、气泡比例及 a11y 准则。

## 验证情况
- 自动化单测：`pnpm --filter @asterism/web test src/components/ask/ask-panel.test.tsx` 11/11 全通；全库 `pnpm test` 52 个套件、272 项测试全部通过；
- 代码质量：`pnpm lint` 351 文件全部通过，0 错误 0 告警；
- 类型检查：`pnpm typecheck` 8 个包全部通过。
