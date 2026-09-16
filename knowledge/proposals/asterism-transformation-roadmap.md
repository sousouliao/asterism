# Asterism Transformation Roadmap

> From GitHub Star Manager to Personal Open Source Memory

## Status

本文保存产品转型的长期方向提案，来源于 2026-09-16 的产品重构讨论。它不是独立的实现授权，也不自动覆盖现有约束。

- `knowledge/contracts/`、已接受的 ADR 与具体 GitHub Issue 是实现时的权威依据。
- 本文与权威文档冲突时，以权威文档为准。
- 每个阶段必须在前置阶段产生真实使用证据后，另行细化和批准。

## Executive Summary

Asterism 已经具备语义检索、Related Stars、可恢复批处理、严格数据边界和 contracts-first 治理等能力。下一步不应继续把这些能力只用于“把 GitHub Stars 整理得更整齐”，而应把产品中心提升为：

> **Asterism is your private memory for open-source software.**
>
> **Star something once. Remember why. Find it when it matters.**

中文定义：

> **记住你曾经关注过的软件，并在真正需要它的时候重新把它带回来。**

Star 是 Memory 被创建的触发事件，而不是产品终点。Asterism 应逐步回答：

- 我为什么收藏过这个项目？
- 我现在的问题，过去收藏过什么可以解决？
- 从我收藏它以后发生了什么？
- 我以前研究过这个方向时做过什么判断？
- 哪些旧收藏现在重新值得关注？

## Product Principles

### Memory over Management

产品优先帮助用户重新发现、理解、判断和使用过去关注过的项目，而不是扩大人工分类工作。

### Personal Context over Generic Metadata

GitHub 已经提供 Stars、Forks、Language、README、Topics 和 Releases。Asterism 最有价值的数据是 GitHub 没有的个人上下文：为什么收藏、当时在解决什么问题、做过什么判断、为何暂缓或拒绝，以及它现在为何仍然相关。

### Retrieval over Browsing

长期主路径应从 `Collection → Repo` 演进为 `Intent → Retrieval → Explanation → Relevant Memories`。Collection 保留为人工组织工具，但不再承担产品中心。

### Explanation over Magic

所有推导结果都必须能回答 “Why is Asterism showing me this?”。不得用不可解释的推荐、分组或生成结果替代用户判断。

### Durable Knowledge over Ephemeral AI Output

派生知识必须记录来源、版本、新鲜度和重建条件。AI 输出不是聊天记录，而是可追踪、可过期、可重建的派生数据。

### Private by Default

个人上下文、研究记录、偏好与行为属于用户。默认只处理个人库；扩大到外部发现、Provider 或 Agent 接口时必须重新定义权限、来源和隐私边界。

## Core Domain Model

### Repo

GitHub repository 的 canonical identity，保存 owner/name、GitHub ID、当前元数据与同步状态。

### Memory

描述 Repository 与 User 之间的关系。首版采用每个 `user × repo` 一条 Memory，承载来源、来源时间、`why_saved` 与自由文本 `note`。未来若 Research 或 Activity 证明需要时间线，再单独演进多事件模型。

### RepoSnapshot

记录 Repo 在某个时间点的关键状态，用于变化检测、知识新鲜度与 “Since you starred it”。候选字段包括 stars、forks、language、topics、license、archived、latest release、README hash 和 metadata hash。

### Facet

从 Repo 或 Memory 中提取的可检索结构，例如 purpose、capabilities、use cases、architecture、runtime、deployment、ecosystem 和 personal relevance。

### Relation

描述 Repo、Memory 或其他知识对象之间的可解释关系，例如 similar-to、alternative-to、successor-of、complements、same-problem 和 useful-together。关系必须包含来源与解释。

### Constellation

动态知识视图，而不是第二套文件夹。它可以由语义、Facet、Relation、个人上下文与用户 pin/exclude 共同形成。现有 Collection 未来可映射为 Manual Constellation，但在有真实需求前不实施。

### ResearchSession

保存一次技术调研的 question、context、constraints、candidates、evidence、comparison、decision 与 rejected reasons，使过去的技术判断可以被重新检索。

### Activity

统一表达 starred、opened、searched、compared、dismissed、saved、used-in-project 和 revisited 等行为信号。只有在 Resurface 需要真实信号后才建立，不提前采集匿名遥测。

### AIArtifact

AI-derived 数据的 provenance 包括 source hash、extractor version、prompt version、model、generated time、source refs 和 confidence。源内容变化后相关 Artifact 应可标记 stale 并重建。

## Target Architecture

长期架构分为四层：

1. **Experience**：Search、Ask、Research、Resurface、Constellation。
2. **Retrieval**：query understanding、lexical/semantic retrieval、structured filters、personal relevance、freshness、rerank 与 explanation。
3. **Knowledge**：Repo、Memory、Snapshot、Facet、Relation、ResearchSession。
4. **Enrichment**：GitHub sync、extract、embed、refresh 与 change detection。

Search、Related、Ask 与 Constellation 不应各自拥有独立检索逻辑。它们最终应成为统一 Retrieval Engine 的不同消费者。

## Transformation Roadmap

### Phase 0 — Reposition and Freeze

目标：停止围绕 Star Manager 扩大复杂度，统一产品定义。

- 更新公开定位、产品契约、架构与路线图。
- 接受产品转型 ADR。
- Collection 降为次级人工组织能力，冻结新的 Collection Management 功能。
- 盘点现有 Search、Related Stars、embedding、Notes、同步和可靠写入能力。
- 明确不采用 Big Bang Rewrite。

退出条件：Contracts、ADR、路线图、公开文案和 Agent 工作入口对产品定义没有冲突。

### Phase 1 — Memory Foundation

目标：建立 Repo 与 User 之间的一等关系数据。

首个功能是 **Why I saved this**：

- 每个已同步 Star 有一条基础 Memory。
- 用户可填写收藏原因与自由笔记。
- 旧 Star 没有上下文时显示 “Not recorded yet”，不得由 AI 编造。
- Repo Quick Look 优先展示个人上下文。
- Memory 可导入、导出、恢复并受 RLS 隔离。

退出条件：任何 Repo 都能回答“它是什么”以及“它为什么与我有关”。

### Phase 2 — Unified Retrieval Engine

目标：让现有关键词搜索、浏览器内 embedding 与 Related Stars 共享同一检索接口。

- 统一 query/context/filter 输入。
- 合并 lexical、semantic、structured 与 personal-context 信号。
- 输出稳定排序和用户可理解的匹配理由。
- 先迁移现有 Search 与 Related Stars；Ask 和 Constellation 只作为后续消费者。

退出条件：现有检索能力不再维护平行排序逻辑，并能检索 Memory 内容。

### Phase 3 — Ask and Resurface

目标：首页从管理统计面演进为 Memory Interface。

- Ask Asterism v1 只回答个人库，不联网。
- 返回仓库、Memory、匹配原因与证据，而不是无来源聊天答案。
- Worth Remembering 与 Recent Memories 必须基于明确、可解释的信号。
- 用户可反馈 Useful、Not relevant、Already know 或 Hide。

退出条件：用户无需先知道目标属于哪个 Collection，也能重新发现相关内容。

### Phase 4 — Time and Freshness

目标：让收藏从 frozen bookmark 变成 evolving object。

- 引入 RepoSnapshot 和变化检测。
- 第一版只跟踪 archived、stars、latest release、topics、language、README 和 license。
- 提供 “Since you starred it” 视图。
- 源内容变化时标记相关派生知识 stale。

退出条件：Asterism 可以回答“从我收藏它之后发生了什么”。

### Phase 5 — Research Session

目标：保存技术调研与决策过程。

- 记录问题、约束、个人库候选、证据、比较、决定和拒绝原因。
- 检索顺序固定为 “My memory first → external discovery second”。
- 外部发现必须另行定义来源、网络、权限和数据保留边界。

退出条件：用户可以找回过去为什么选择或没有选择某个方案。

### Phase 6 — MCP and Agent Interface

目标：不打开 Asterism UI 也能使用个人开源记忆。

候选接口包括 `search`、`get_repo`、`get_memory`、`related`、`explain`、`research` 和 `recent_changes`。接口必须继承用户权限、证据和隐私边界。

退出条件：开发工具可以安全查询并引用 Asterism 的核心知识，而不能绕过数据访问层。

### Phase 7 — Constellations

目标：在统一检索和关系证据成熟后，把 Collection 逐步扩展为动态知识视图。

- 支持 Facet、Relation、动态 membership、用户 pin/exclude 与解释。
- 保留 Collection，先映射为 Manual Constellation，不做破坏性删除。

退出条件：动态成员关系可解释、可纠正，且完成明确用户任务。

### Phase 8 — Taste Graph

目标：建立显式、用户拥有的技术偏好。

- 偏好必须可见、可编辑、可关闭、可删除并展示来源。
- 禁止建立不可见用户画像。
- 搜索只能把偏好作为可解释信号，不能替代相关性或用户选择。

退出条件：个性化行为可由用户检查和控制。

### Phase 9 — Idea Collision

目标：发现不相似但组合后有价值的项目，即 “Distant but Useful”。

- 候选必须提供潜在组合价值和证据。
- 只在 Memory、Retrieval、Relation 与反馈信号成熟后评估。
- 不以视觉新奇或二维星图作为价值证明。

退出条件：真实用户能够借此形成可执行的新判断或方案。

## Recommended Build Order

严格顺序：

1. Reposition
2. Memory
3. Retrieval Engine
4. Ask and Resurface
5. Snapshot and Freshness
6. Research
7. MCP
8. Constellation
9. Taste Graph
10. Idea Collision

不要先做 AI Chat、Knowledge Graph Visualization、Fancy Constellation Map、Taste Graph 或 External Search。这些能力都依赖 Memory 与 Retrieval 基础。

## Migration Strategy

- 不进行 Big Bang Rewrite；现有系统继续工作，新领域逐步接管职责。
- Collection 保留为兼容的人工组织能力，不继续扩大其产品中心地位。
- Related Stars 保留，并作为统一 Retrieval Engine 的首批消费者。
- 现有浏览器内 embeddings 优先复用；没有证据时不重建多 Facet 向量体系。
- 当前没有真实用户数据，Memory Foundation 可采用干净 cutover；仍通过顺序 migration 保持开发环境和仓库 schema 一致。
- 每次 schema、产品边界或接口改变都同步 Contracts、ADR、state 与 logs。

## First 30 Days

### Week 1 — Product contract

- 保存本提案。
- 接受产品转型 ADR。
- 更新产品、架构、数据模型、UI/UX、路线图与公开文案。
- 把当前 frontier 改为 Memory Foundation。

### Week 2 — Memory data path

- 建立一对一 Memory schema、RLS、领域类型与数据访问接口。
- 把现有 Note 能力合并进 Memory。
- Stars 同步幂等创建基础 Memory。

### Week 3 — Why I saved this

- 在 Repo Quick Look 提供 Why saved 与 Note 编辑。
- 完成草稿保护、失败恢复、双语和可访问性。
- 更新导入导出格式与旧格式兼容。

### Week 4 — Validation

- 完成自动化与真实 Supabase smoke test。
- 使用真实个人 Star 库填写一批 Memory，验证输入成本和实际价值。
- 依据结果决定是否创建统一 Retrieval 的下一张纵向 issue。

## First ADR

第一条决策应回答：

- 为什么从 GitHub Star Manager 转向 Personal Open Source Memory。
- 哪些现有能力保留并复用。
- 为什么 Memory 是下一阶段的一等实体。
- 为什么 Collection 保留但降为次级能力。
- 为什么当前不做 Chat、外部搜索、Snapshot、Research、MCP 和动态 Constellation。
- 如何通过纵向切片和契约门禁避免产品叙事与实现漂移。

## First Functional Change

第一项运行时改动只交付完整的 **Memory + Why I saved this**：schema、RLS、同步、数据访问、Quick Look、失败恢复、i18n、导入导出、测试与知识库一次闭环。不要把它拆成数据库、API 和 UI 各自不可用的 issue。

## Explicit Non-Goals

- 不做 Raindrop + AI 或 Notion for GitHub Stars。
- 不做以聊天界面代替检索基础的 AI wrapper。
- 不做二维 embedding 星图作为核心价值。
- 不自动编造用户过去收藏项目的原因。
- 不在 Memory 之前构建 Ask、Resurface、Taste Graph 或 Idea Collision。
- 不恢复已退役的服务端 BYOK Generation 或自动整理流程。
- 不扩大 GitHub OAuth 写权限。
- 不做团队工作区、实时协作或匿名产品遥测。
- 不提前构建多来源 Memory 时间线、通用知识图谱或复杂 enrichment 平台。

## Decision Filter

未来每项能力都必须回答：

> **Does this help me rediscover, understand, evaluate, or reuse something I once cared about?**

如果答案是否定的，则不应进入近期路线。
