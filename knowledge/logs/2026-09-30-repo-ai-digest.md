# 2026-09-30 · 单仓库核心速读（AI 智能提炼）端到端落地

## 背景

1. **信息过载与认知成本**：很多 GitHub Star 仓库的 README 篇幅冗长、包含大量徽章、安装脚本与示例，用户在 Quick Look（仓库详情抽屉）中难以在 5 秒内快速抓住项目本质（到底是什么、解决什么痛点、核心场景）。
2. **渐进式走查与极简重塑**：
   - **视觉图标收敛**：放弃繁杂的多图标堆砌，选用纯粹灵动的「灵感火花」（`Sparkles`）表达 AI 智能提炼；
   - **信息架构减负**：彻底摒弃非必要的生态对标等发散信息，收敛至「一句话定义、核心痛点、适用场景」三大不可替代的核心维度；
   - **几何对称与 0 抖动排版**：修复微晶卡片上边距偏宽问题（重构为匀称的 `px-3.5 pt-2 pb-2.5`）；显式统一生成中与已完成状态的标题行高（`flex h-6 items-center`，顶栏高度锁定 31px，底边分割线锁定在 38px 处），消除生成前后的像素级抖动（CLS）；
   - **提示词工程遵循契约**：严格遵循 Matt Pocock 的 `writing-for-agents` 规范重构 Prompt，消除否定句可能引发的大象反噬、采用先验 Leading words、就地归拢字段规则（Co-location），并限定严格的完成标准。

## 变更

- **核心算法与 Prompt 契约（`packages/core`）**：
  - `packages/core/src/repos/digest-prompt.ts`：
    - `cleanReadmeForDigest`：过滤脚本、样式、SVG、HTML 注释、Markdown 徽章与图片链接，并在安全保留前 2,500 字符的前提下，自动识别并裁剪 License、Contributing、Sponsors 等低价值尾部章节；
    - `buildRepoDigestPrompt`：构建高遵循度的 system 与 user 提示词，注入目标语言指令与单行纯 JSON 要求；
    - `parseRepoDigest`：支持解析原始 JSON 或 Markdown 代码块包裹的 JSON，包含字段完整性与类型安全校验。
  - `packages/core/src/repos/digest.ts` 及 `packages/core/src/index.ts` 导出统一数据结构与纯函数。
  - `packages/core/src/repos/digest-prompt.test.ts`：补充 9 项严密单元测试。
- **客户端本地存储与同步机制（`apps/web/src/lib/repo-digest-storage.ts`）**：
  - 基于 `asterism:repo-digest:v1:${userId}` 实现版本化与多用户隔离持久化；
  - 结合内存缓存与 `useSyncExternalStore` 订阅机制，支持单页面极速响应与跨标签页 `StorageEvent` 实时同步；
  - `apps/web/src/lib/repo-digest-storage.test.ts`：补充 3 项本地存储读写与事件订阅单测。
- **状态编排与数据 Hook（`apps/web/src/data/use-repo-digest.ts`）**：
  - `useRepoDigestManager(record)`：串联用户 Session、BYOK 模型配置（`useAskByok`）、README 加载缓存（`loadRepoReadme`）、Prompt 生成、`streamAskGenerate` 代理调用、解析与持久化；
  - 覆盖完整状态机：`idle`、`generating`、`completed`、`unconfigured`、`error`；
  - 优雅兼容 `QueryClientContext`，测试环境无 Provider 场景安全回退；
  - `apps/web/src/data/use-repo-digest.test.tsx`：补充 4 项集成测试（含未配置 Key、缓存秒开、流式调用与异常重试）。
- **微晶视觉呈现与抽屉集成（`apps/web`）**：
  - `apps/web/src/components/repo-digest/repo-ai-digest.tsx`：纯净微晶卡片，支持流光骨架屏动画、生成失败错误条与原地重试、未配置 Key 直达设置页引导；
  - `apps/web/src/components/repo-inspector.tsx`：在 Quick Look 抽屉 Overview 区域（元数据与“阅读 README”按钮之间）挂载 `RepoInspectorDigest`；
  - `apps/web/src/pages/repo-digest-preview.tsx`：提供开发走查预览面板，支持全状态一键切换与实机走查。
- **国际化（i18n）**：
  - `apps/web/src/i18n/locales/zh-CN.json` 与 `en.json` 同步补充 `digest` 完整键值对，严格通过 `locales.test.ts` 规范校验。

## 验收

- 全项目 Biome 代码规范与格式化通过（`pnpm lint`）。
- 全项目 TypeScript Strict 类型检查通过（`pnpm typecheck`，9/9 任务成功）。
- 全项目 59 个测试套件共 313 项单测全部通过（`pnpm test`）。
