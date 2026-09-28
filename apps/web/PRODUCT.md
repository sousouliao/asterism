# Product

<!-- impeccable:product-schema 1 -->

> This file is the impeccable-facing summary of Asterism's product context, kept in sync with `knowledge/contracts/product.md` and `knowledge/contracts/ui-ux.md` at the repo root. **Those contracts are the single source of truth** (see root `AGENTS.md`); if this file and the knowledge base ever disagree, the knowledge base wins.

## Platform

web

## Users

- **重度 Star 用户**：曾关注数百或上千个开源项目，却无法回忆当时为何收藏、后来是否仍相关。
- **开发者与技术研究者**：需要在日常开发与调研中，从过去关注的软件中快速找回适合当前问题的工具、决策判断与个人上下文。
- **注重数据自主与隐私的用户**：偏好开源、可自部署、私密存储且数据随时可导出的本地优先方案。

Context: 开发者坐在工作台前，处于开发或技术选型的工作流中——试图找回某个特定仓库的收藏原因，或寻找解决当前工程痛点的历史收藏。用户的核心需求是“私有记忆沉淀与精准检回”，而非娱乐性浏览或虚荣指标。

## Product Purpose

Asterism 是一个**开源、多端、可自部署的个人开源软件记忆库**（your private memory for open-source software）。GitHub Stars 是其首个来源；产品致力于帮用户沉淀 GitHub 原生缺乏的个人私有上下文，并在需要时重新找到、理解和使用曾关注的软件。

`apps/web` 是当前的核心载体，覆盖账号认证、Star 完整同步与历史对账、卡片/列表响应式浏览（虚拟滚动）、多维客观筛选、隐形混合搜索、Quick Look 记忆检视与编辑、记忆沉睡唤醒流（Resurface）、集合整理（Collections）、本地问答（Ask Asterism）以及备份导入导出。

## Positioning

- **私有记忆优先于公开社交图谱**：Asterism 不靠 AI 凭空猜测用户为何收藏，也不将用户的私人笔记与关注点外泄；Memory 严格由用户主权掌控。
- **端侧优先与隐私至上的 AI 实践**：混合检索由浏览器端轻量向量模型支持；Ask Asterism 问答基于用户自带 Key（BYOK），检索与证据严格限定于个人收藏库，零外网搜索、零虚假推荐，Key 与私有数据不留存服务端。
- **纯粹的工具秩序感**：拒绝千篇一律的 SaaS-cream 营销视觉模板，提供克制、高密度、专业面向开发者的工作台体验。

## Operating Context

- **运行环境**：响应式现代 Web 浏览器桌面端与移动端（桌面为主），自托管 Supabase（Auth + Postgres + Edge Functions）。
- **外部集成**：GitHub 个人账号（OAuth 认证、只读 Star 列表同步、自动后台静默补同步与快照对账）。
- **核心工作流**：
  1. 浏览与过滤：快速在几百上千个 Star 仓库中按语言、Topic、更新时间等客观属性筛选；
  2. 隐形检索：无需切换模式，直接输入关键词或自然语言意图，融合词法与语义即时召回；
  3. 记忆沉淀：在 Quick Look 中记录 `whySaved`（为何收藏）与 `note`（备忘笔记）；
  4. 唤醒与追溯：通过 Resurface 发现长期未触碰但仍具价值的技术资产；
  5. 智能问答：在底部 Ask 胶囊中针对个人收藏库直接提问并获得证据支持。

## Capabilities and Constraints

- **核心能力**：
  - GitHub Stars 完整对账、快照管理与取消 Star 历史找回；
  - 卡片视图 / 列表视图虚拟滚动（TanStack Virtual）；
  - 隐形混合搜索（Lexical + In-browser Embedding）与 Related Stars 语义探索；
  - Quick Look 非模态仓库详情与 Memory（`whySaved`, `note`）双字段编辑保护；
  - 沉睡唤醒流（Resurface & Memory Streams）与本地反馈持久化；
  - 次级人工组织分组（Collections）；
  - Ask Asterism 目录常驻 Agent 智能问答（BYOK 本地加密存储）；
  - JSON v3 完整数据备份导入与导出。
- **技术与范围约束**：
  - 严格 TypeScript、Biome 门禁、Vitest 自动化套件；
  - 纯自部署架构，数据源仅限用户授权的 GitHub Stars；不接入全网爬虫；
  - 扩展（Extension）与桌面端（Desktop）暂缓，待 Web 端记忆与检索底座稳固后推进。

## Brand Commitments

- **名称**：Asterism（星群）。
- **Logo 与意象**：单色电光蓝星群拓扑图标，连线克制淡化；严禁蓝紫渐变、装饰性发光与空洞星图点云。
- **品牌基调**：克制、专业、面向开发者；信息密度与工具感优先于营销视觉。

## Evidence on Hand

- 用户 GitHub 真实 Star 列表与更新时间对账数据；
- 用户在本地或 Supabase 存储的真实 Memory 记录；
- 浏览器内确定的语义向量与本地测试夹具；
- 系统中所有推荐理由与检索匹配徽标必须有确凿字段（Memory/Topic/描述）为证，禁止伪造证据。

## Product Principles

1. **工具感而非营销感**：产品服务于用户的检索与记忆效率，不靠视觉噱头与炫技动效说服。
2. **用户掌控 Canonical**：用户的 Memory 与 Collection 仅由用户明确操作修改，AI 绝不擅自揣测、修改或覆盖真实意图。
3. **数据自主与开源优先**：自部署架构、端侧加密、随时可全量导出，杜绝任何形式的平台数据锁定。
4. **防幻觉检索准则**：问答与推荐卡片必须 100% 映射到用户收藏库内可验证的真实仓库，宁缺毋滥。
5. **隐喻服务功能**：“星座/星群”意象服务于心智理解，不得喧宾夺主制造复杂繁琐的交互路径。

## Accessibility & Inclusion

- **目标标准**：WCAG 2.1 AA 级标准（色彩对比度达标、键盘全路径可操作、焦点反馈清晰）。
- **明暗双主题**：Graphite Glass light 与 dark 均为一等公民，禁止粗暴的浅色反转；首帧注入防闪烁。
- **无障碍交互**：完整支持 `prefers-reduced-motion` 动效降级，表单与交互控件均具备严格的 ARIA 与读屏适配。
