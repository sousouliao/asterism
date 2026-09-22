# 2026-09-22 · 下拉菜单与浮层 Trigger 激活态（Active State）统一优化

## 触发背景
在设置页 AI 连接卡片中，点击操作「更多」按钮（`...`）唤出下拉操作浮层（禁用、测试、编辑、删除）时，触发按钮本身无任何 active / open 激活反馈，浮层展开期间按钮依然保持平铺暗淡态。同时排查系统中所有下拉浮层、选择器与弹出层 trigger，一并补全激活反馈。

## 根因分析
1. `packages/ui/src/components/ui/button.tsx` 的 `buttonVariants` 变体（尤其是 `ghost` 与 `outline`）仅定义了 `hover:bg-accent hover:text-accent-foreground`，缺失 Radix 弹层展开时挂载在触发器上的 `data-[state=open]` 与 `aria-expanded="true"` 伪属性样式映射。
2. 导致当通过 `<DropdownMenuTrigger asChild>`、`<PopoverTrigger asChild>` 等包裹 Button 时，点击弹出浮层后，只要鼠标移入菜单项或失焦，触发按钮就会失去悬停态并退回完全透明的闲置无激活态。
3. 业务层在部分卡片操作按钮上追加了 `text-muted-foreground`，在浮层展开和悬停时缺乏明确的前景色激活提亮。
4. 筛选栏通用 trigger 基础类 `FILTER_TRIGGER_CLASS` 及 `SelectTrigger` 亦缺乏 `data-[state=open]` 展开态视觉反馈。

## 变更内容

### 1. UI 基础组件 Button 变体激活态映射（`packages/ui/src/components/ui/button.tsx`）
- `ghost`: 增加 `data-[state=open]:bg-accent data-[state=open]:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground`；
- `outline`: 增加 `data-[state=open]:bg-accent data-[state=open]:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground`；
- `secondary`: 增加 `data-[state=open]:bg-secondary aria-expanded:bg-secondary`；
- `default`: 增加 `data-[state=open]:bg-primary/90 aria-expanded:bg-primary/90`。

### 2. SelectTrigger 展开态边框与底色反馈（`packages/ui/src/components/ui/select.tsx`）
- 为 `SelectTrigger` 补充 `data-[state=open]:border-foreground/60 data-[state=open]:bg-accent/40`，在展开下拉选择时与表单控件 `focus-visible:border-foreground/60` 保持一致的激活聚焦感。

### 3. Browse 筛选栏通用 Trigger 展开态（`apps/web/src/components/filter-trigger.ts`）
- `FILTER_TRIGGER_CLASS`: 补充 `data-[state=open]:bg-accent/70 data-[state=open]:text-accent-foreground aria-expanded:bg-accent/70 aria-expanded:text-accent-foreground`；
- `FILTER_TRIGGER_ACTIVE_CLASS`: 补充 `data-[state=open]:bg-primary/10 aria-expanded:bg-primary/10`，确保语言、许可证、集合、主题、更多筛选及排序展开时均具备明确激活态。

### 4. 业务组件操作按钮与触发器排查补齐
- **AI 连接管理卡片更多按钮**（`apps/web/src/components/ai-connections-manager.tsx`）：补充 `hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground`；
- **Collections 集合卡片更多按钮**（`apps/web/src/pages/collections.tsx`）：补充 `hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground`；
- **Ask 对话舱模型切换胶囊**（`apps/web/src/components/ask/ask-panel.tsx`）：补充 `data-[state=open]:bg-black/[0.06] data-[state=open]:text-foreground dark:data-[state=open]:bg-white/10 aria-expanded:...` 展开态底色与文字高亮。

### 5. 单测与回归验证
- 扩展 `apps/web/src/components/ai-connections-manager.test.tsx`：验证菜单弹出时 trigger 拥有 `data-state="open"` 且包含激活类名；
- 新增 `apps/web/src/components/trigger-active-states.test.tsx`：全覆盖测试各类变体 Button、FILTER_TRIGGER 与 SelectTrigger 的激活属性映射。

## 验证情况
- 单测：`pnpm test` 全库 53 个套件、279 项测试全部通过；
- 类型：`pnpm typecheck` 全库 8 个包全部通过；
- 门禁：`pnpm lint`（biome check .）352 文件 0 错误通过。
