# 2026-09-22 · Ask 模块 Apple Liquid Glass 物理质感升级

## 1. 任务背景

用户在体验 Ask Asterism 的底部输入框与 `/` 斜杠命令交互时反馈：**当前背景虽然有模糊，但呈现为大面积泛白的半透明“牛奶雾（Milky Fog）”，缺乏 Apple 官方（visionOS / macOS Materials）那种通透、有实体厚度、带边缘折射与镜面高光的 Liquid Glass（液态玻璃）质感。**

## 2. 业界调研与根因剖析

对比 Apple 官方 Human Interface Guidelines（Materials & Vibrancy）与业界顶级 Web 实现（CodePen / Raycast / Linear 等）：
1. **底色不透明度过高导致磨砂变涂料**：
   原实现中在 `ask-panel.tsx` 采用了 `from-[var(--background)] via-[var(--background)]/80`。浅色模式下 `--background` 接近 `#f5f6f8`，叠加后底部 40% 区域的不透明度达到 80%~100%，等于将底层仓库卡片直接涂白覆盖，`backdrop-blur` 无法透出底色的反光折射，失真为平面“白雾”。
2. **缺乏玻璃物理厚度（Thickness）与倒角镜面高光（Specular Bevel）**：
   原 `AskSlashMenu` 采用了 `border-0`，仅靠二维模糊与淡阴影，缺乏 Apple 材质中最精髓的**顶边缘 1px 镜面反射亮线（Inset Specular Highlight）**与清晰的物理倒角，像一张平面贴纸。
3. **多层半透明叠层造成对比度洗脱（Wash out contrast）**：
   大面积泛白氛围上叠放纯白菜单，文字和图标失去对比张力。

## 3. 实施变更

1. **AskPanel 氛围流体层重构 (`apps/web/src/components/ask/ask-panel.tsx`)**：
   - 彻底摒弃实白/灰底 `from-[var(--background)] via-[var(--background)]/80`；
   - 升级为清透晶莹的流体渐变底色（浅色 `from-white/35 via-white/15 to-transparent`，暗色 `from-[#0B0E13]/55 via-[#0B0E13]/25 to-transparent`）；
   - 复合高阶光学后置滤镜：`backdrop-blur-2xl backdrop-saturate-[185%] backdrop-contrast-[104%]`，使穿透底层卡片的色彩鲜艳饱满且锐利；
   - 平滑羽化遮罩：`[mask-image:linear-gradient(to_top,black_30%,transparent_100%)]`；
   - 结合底部电光蓝径向微晕染（`radial-gradient`），杜绝大面积死白，实现真正的液态水润感。
2. **AskSlashMenu 注入 Apple 物理玻璃厚度 (`apps/web/src/components/ask/ask-slash-menu.tsx`)**：
   - 替换 `border-0`，加入发丝级镜面玻璃描边：`border border-white/80 dark:border-white/15`；
   - 注入双层 Inset 镜面高光与立体柔和落影：
     `shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.95),0_16px_36px_-6px_rgba(15,23,42,0.14),0_4px_12px_-2px_rgba(15,23,42,0.06)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),0_16px_36px_-6px_rgba(0,0,0,0.6)]`；
   - 底色优化为 `bg-white/75 dark:bg-[#151D2A]/80`，结合 `backdrop-blur-2xl backdrop-saturate-[190%] backdrop-contrast-[102%]`；
   - 选项激活态增加同源玻璃内凹高光。
3. **AskHistoryView 记忆卡片瓦片升级 (`apps/web/src/components/ask/ask-history-view.tsx`)**：
   - 为历史会话列表的 Session Card 注入 `border border-white/70 dark:border-white/10` 与 `shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)]`，高亮时微幅上浮并增强顶部镜面反射。
4. **会话流与斜杠命令互斥聚焦（礼貌避让机制）**：
   - 彻底解决用户指出的“同时出现对话和命令，毛玻璃双层文字穿透重叠导致可读性极差”的严重问题；
   - 在 `ask-panel.tsx` 中将对话流渲染条件与宽度约束联动：当 `isSlashOpen` 为真时，上方对话流临时平滑收拢避让，输入框宽度自适应收紧为 Spotlight 级别紧凑宽度，命令浮层纯净悬浮在 Apple Liquid Glass 背景之上；
   - 当用户按退格清空 `/` 或按 Esc 退出时，对话气泡流无缝弹回恢复，上下文与阅读位置完全保留；若选中 `/history` 则顺畅切入历史列表，若选中 `/new` 则开启新对话。
5. **设计契约同步 (`knowledge/contracts/ui-ux.md`)**：
   - 更新 Ask Dock Pattern 中关于 Liquid Glass 氛围层与斜杠菜单浮层的材质、羽化区间及倒角高光规范。

## 4. 验证与工程门禁

- 运行单元测试套件：`pnpm test` 全部通过（零失败）；
- 运行代码检查与类型校验：`pnpm check` 全部通过（零报错）。
