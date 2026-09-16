# Product

> This file is the impeccable-facing summary of Asterism's product context, kept in sync with `knowledge/contracts/product.md` and `knowledge/contracts/ui-ux.md` (Brand Tone section) at the repo root. **Those contracts are the single source of truth** (see root `AGENTS.md`); if this file and the knowledge base ever disagree, the knowledge base wins and this file should be updated to match.

## Users

- **重度 Star 用户**：曾关注数百或上千个开源项目，却无法回忆当时为何收藏。
- **开发者与技术研究者**：需要从过去关注的软件中重新找到适合当前问题的工具和判断依据。
- **跨设备 / 跨端用户**：希望在浏览器、扩展、桌面之间共享同一份组织好的收藏。
- **注重数据自主**：偏好开源、可自部署、数据可导出的方案。

Context: developers, at their desk, mid-workflow — trying to recover why a repository mattered or which previously saved project fits the problem at hand. The job is memory and retrieval, not discovery for entertainment or classification for its own sake.

## Product Purpose

Asterism 是一个**开源、多端、可自部署的个人开源软件记忆库**。GitHub Stars 是首个来源；产品帮助用户保留私人上下文，并在需要时重新找到和理解曾关注的软件。

`apps/web` is the current primary surface，覆盖登录、同步、浏览、多维筛选、隐形混合搜索、Related Stars、Collection、Note、手动批量整理、统计与导入导出。ADR 0037 把 Memory Foundation 设为当前 frontier；success = 用户能在需要时找回相关软件，并理解它为什么曾经值得保存。Collection 保留为次级人工组织能力，不再是产品中心。

## Brand Personality

- **克制、专业、面向开发者**：低调工具感，不靠视觉说服，靠效率说服。
- **秩序感优先于装饰**：信息密度优先，动效克制而不喧宾夺主。
- **星座隐喻**：collections 可呼应"星座"意象，但不能让功能表达含糊——隐喻服务功能，不喧宾夺主。不要用 Tag 作为第二套组织概念。

## Anti-references

- **千篇一律的 SaaS-cream AI 套路**：渐变卡片、hero-metric 模板（大数字+小标签+渐变强调）、统一同尺寸卡片网格、每个 section 头顶小型 uppercase eyebrow、编号 01/02/03 装饰性分区标记。这些是训练数据里最常见的"一眼 AI 做的"信号，Asterism 要避开。
- **臃肿的书签管理器 / 传统后台 CMS 的拥挤感**：不做通用书签工具的视觉语言（大量图标+文字卡片墙），也不做传统企业后台那种密集表格+侧边栏堆砌的沉闷感；参考 GitHub 自身 Primer 设计体系的克制与秩序感。

## Design Principles

1. **工具感而非营销感**：产品服务用户效率，不靠视觉噱头说服；克制优先于炫技。
2. **多端一致的视觉语言**：web / extension / desktop 共享 `packages/ui` 的同一套组件与 tokens，平台差异留在各端壳层。
3. **状态透明**：同步中 / 完成 / 失败等状态要清晰可见，用户始终知道数据处于什么阶段、来自哪里。
4. **隐喻服务功能，不喧宾夺主**："星座"主题词可用但不能让操作路径或信息层级变得含糊。
5. **数据自主与开源优先**：可自部署、数据可导出，视觉与交互不应制造"锁定感"（如隐藏导出入口、模糊数据归属）。
6. **用户掌控 canonical**：Memory 与 Collection 只由用户的明确操作修改；浏览器内语义能力只帮助检索和发现相关收藏，不猜测用户为何保存。

## Accessibility & Inclusion

- **目标 WCAG 2.1 AA**：颜色对比度达 AA、可键盘操作、焦点可见（`--ring`）、合理的语义化标签与 ARIA、虚拟滚动列表的可访问性。
- **明暗模式**：默认跟随系统 + 可显式切换，light / dark 均为一等公民，对比度在两套主题下都需达标。
- 未来动效需提供 `prefers-reduced-motion` 的等效方案（当前项目动效克制，风险较低，但新增动效时须补上）。
