# ADR 0039 · 统一检索引擎与个人记忆融合（Unified Retrieval with Memory & Match Explanations）

- Status: Accepted
- Date: 2026-09-17
- References: GitHub #39, ADR 0016, ADR 0021, ADR 0027, ADR 0037, ADR 0038

## Context

在 Asterism 转向「Personal Open Source Memory」后，用户的私有记忆（`why_saved` 与 `note`）成为个人知识库的关键组成部分。
此前系统的检索实现存在以下局限：
1. **记忆被动割裂**：检索仅覆盖客观仓库属性（名称、描述、语言、主题），用户的个人收藏动机与笔记未参与词法检索与语义向量空间；
2. **检索逻辑分散**：过滤匹配分散在 UI 前端与多处 helper 中，缺乏跨平台（Web/Extension/Desktop）通用的标准化检索接口；
3. **黑盒缺乏解释**：用户无法得知结果为何匹配（是命中客观 README/主题，还是命中了自己几个月前写下的收藏动机）；
4. **推荐孤立**：Related Stars 仅基于公共仓库特征做语义近邻，未考虑用户自身在不同项目上的意图共鸣，且在 WebGPU/WASM 不可用时缺乏合理的降级推荐。

## Decision

1. **Memory 深度融入向量空间与内容签名**：
   - 扩充 `EmbeddableRepo` 支持 `whySaved` 与 `note`，生成 passage input 时结构化合并个人动机与笔记；
   - `repoContentHash` 覆盖 Memory 内容，任何记忆保存与修改自动令旧签名失效，并通过 `useEmbeddingBootstrap` 触发增量重嵌。
2. **在 `@asterism/core` 建立统一检索接口（`retrieveRepos`）**：
   - 统一收拢词法多字段倒排匹配（记忆动机、笔记、仓库名、描述、主题）、分面筛选、时间排序与语义扩展；
   - 匹配结果按个人意图优先排序（`why_saved` > `note` > `name` > `description` > `topic`）；
   - 输出结构化 `MatchExplanation`（含 primaryReason、所有命中 reasons 与上下文高亮 snippet），由前台组件呈现给用户。
3. **意图共鸣与优雅降级的 Related Stars**：
   - `findMutualSemanticNeighbors` 引入意图共鸣权重：当两个仓库均沉淀有用户个人记忆且处于正向语义距离时，给予微量意图加成，使具有个人关联思考的项目更易成为互为近邻；
   - 引入 `findKeywordFallbackNeighbors`：在语义向量模型未就绪、无向量数据或弱设备（unsupported）上，综合利用 Topics、语言与 Memory 关键词交集，提供轻量可靠的降级推荐。
4. **克制优雅的前端可解释性 UI（基于 `/impeccable` 原则）**：
   - 设计 `MatchExplanationBadge`，卡片与列表均支持紧凑徽章与丰富 Tooltip 查看命中详情；
   - 严格支持中英双语（i18n）与无障碍标准（ARIA、键盘焦点），不给用户造成认知负担与视觉喧扰。

## Consequences

- 检索结果与推荐从「公共开源软件元数据索引」真正进化为「个人记忆检索与意图唤醒」；
- 完全保持私有优先，无任何服务端数据外传或外部第三方模型依赖；
- 弱设备降级策略完善，无任何白屏或空态死角；
- 为后续 GitHub #40（沉睡唤醒 Resurface）与 #41（私有问答 Ask Asterism）提供了统一、准确、可解释的上下文检索底座。
