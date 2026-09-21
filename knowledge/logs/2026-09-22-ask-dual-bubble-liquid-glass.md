# 2026-09-22 · Ask Asterism 对话双侧气泡与 Liquid Glass 质感升级

应用户对对话界面更优雅、更具流动通透感的设计需求，将 Ask Asterism 的问答界面升级为双侧气泡模式，并重构为 Liquid Glass（流体毛玻璃）材质体系。

## 背景与动因

此前 Ask Asterism 采用用户消息右侧气泡、AI 回答无气泡直接裸贴面板的设计，且浮动面板背景近乎实心白底（`0.9` 不透明度），在浅色模式下呈现为沉重的大白卡片，缺乏呼吸感与通透度；用户提出将其改为双侧气泡对话模式，并赋予背景透明渐变模糊的 Liquid Glass 质感。

## 关键设计与实现

1. **双侧气泡对话体系**：
   - **用户消息气泡 (`AskQuestionBubble`)**：右对齐，造型采用精致的 `rounded-2xl rounded-br-xs`，材质为石墨蓝微渐变流体玻璃，带有微内阴影与半透明高光边缘。
   - **Asterism 助手气泡 (`AskAnswerBubble`)**：左对齐（`max-w-[95%] sm:max-w-[90%]`），左上微收窄（`rounded-2xl rounded-tl-xs`）；顶部加入星光微标识与「Ask Asterism」身份标示；内部包裹流式 `StreamingMarkdown` 正文。
   - **内嵌推荐卡片 (`AskRecommendationCard`)**：在助手气泡内部末尾整齐排列，升级为微毛玻璃渐变卡片（`rounded-xl border border-white/60 bg-white/50 backdrop-blur-xs`），悬停带有高光与微弱阴影。
   - **状态统一收拢**：工具过滤、检索、展开、生成中以及各类异常兜底，统一收纳在左侧助手气泡中。

2. **Liquid Glass 材质与无阴影纯净质感升级**：
   - **全宽流体毛玻璃氛围背景（Ambient Liquid Atmosphere）**：摒弃生硬的几何拱形，采用全视口宽度的自下而上渐变羽化层（`h-[min(52rem,92vh)]`），结合 `backdrop-blur-2xl`、`backdrop-saturate-[190%]` 与线性渐隐蒙版（`[mask-image:linear-gradient(to_top,black_40%,transparent_100%)]`），并在底部中央融入极其柔和的液态微流光（Liquid Spectrum / Caustics，微弱电光蓝晕染），使背景自然呈现水波流动般的折射感。
   - **彻底消除气泡外部黑灰色阴影**：移除所有不协调的外部脏暗黑投影，彻底解决玻璃感被黑阴影破坏的问题；纯粹通过物理入射内高光亮线（`shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.95)]`）与超细半透明晶体描边勾勒形体。
   - **水润凝玉微通透气泡**：助手气泡采用 80% 凝玉微通透底色结合 `backdrop-blur-xl`，由于底层背景已充分雾化，文字具备 100% 清晰可读性且充满水润折射感；用户气泡采用液态宝石蓝；输入框与推荐卡片同步升级同款水润高光材质。
   - **轻量控制**：右上角极简高光微药丸关闭按钮，支持 Esc 键收起。

3. **契约与验证**：
   - 更新 `knowledge/contracts/ui-ux.md` 中的 Ask 对话舱规范。
   - `ask-panel.test.tsx` 11 项单元测试全部通过。
   - 全局测试（52 文件、272 测试）与 `pnpm lint` / `pnpm typecheck` 全部通过。
