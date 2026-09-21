# ADR 0045 · Ask 改为目录常驻浅层 Agent

- Status: Accepted
- Date: 2026-09-21
- Amends: ADR 0042 第 5 条（「本地 top-K 召回 + 候选索引校验」）；ADR 0044 的推荐哨兵体从候选索引改为稳定 `repoId`
- Preserves: ADR 0042 的 BYOK、Provider 白名单、无状态代理、不做抽取式兜底、不联网搜索、证据卡片只渲染本地数据；ADR 0043 的连接管理与 `models` 动作；ADR 0044 的流式 Markdown 与 `StreamingMarkdown` 隔离
- Implements: 全库目录常驻上下文、按需 `filter` / `search` / `expand`、read gate、可续接预算、能力分级降级、consent v3

## Context

ADR 0042 把 Ask 钉在固定两阶段 RAG：客户端词法 + 可选 embedding 召回 top-12，再单次生成。
多轮追问每轮重跑检索，且 prompt 声明「上一轮仓库除非重列否则不可用」。真实使用里，
「第二个呢」「它和前面那个比」会因 `tokenizeQuestion` 抽不出实义词而走 `not_found`。
`MINIMUM_LEXICAL_SCORE = 2` 与 `ASK_CANDIDATE_LIMIT = 12` 构成分数地板加召回天花板——
低于门槛的仓库模型永远看不见。

同时，语料规模与典型 RAG 完全不同：收藏库已在浏览器内存，数百到两千个仓库的元数据
放得进主流模型上下文。Anthropic 从 Claude Code 的 embedding RAG 改到 agentic search
（grep / glob / read），理由是更准、更简单、避免索引陈旧；其 Agent SDK 建议
「从 agentic search 起步，只在需要更快或更多变体时再加语义检索」。对我们，
「让模型看到真相」不必靠 grep——目录可以直接常驻。

embedding 对精确标识符（`axum`、`ripgrep`）弱。Ask 不再依赖 `user_repo_embeddings`；
该子系统继续服务统一 Retrieval 与 Related Stars。

## Decision

1. **主干是目录常驻，不是检索流水线。** 每轮把个人库目录作为稳定 system 前缀：
   - ≤800：完整行（`repoId | fullName | 语言 | topics | 描述截断 80`）
   - 800–2500：精简行（去掉描述）
   - \>2500：按语言 / topic 分组带计数，模型看得见库的形状
   私有笔记不进目录。目录跨轮不变，便于 Provider 前缀缓存。

2. **工具是确定性本地函数，不是远端检索。** 浏览器内对已加载的 Stars / Memory 执行：
   - `filter`：结构化穷举，返回完整结果集（超长分页但告知总数）
   - `search`：词法模糊查询，无最低分门槛，默认 limit 50
   - `expand`：完整描述、star 数、加星时间、`whySaved` / `note`
   零网络、毫秒级。Agent 循环跑在客户端；`ask-generate` 仍是无状态代理，透传
   `tools` 与 `tool` 角色，SSE 增加 `tool_call` 事件。

3. **read gate 取代候选索引。** 推荐哨兵体改为 `repoId` JSON 数组。客户端硬校验
   「推荐 id ∈ 本轮已 `expand` 的集合」。模型不得只凭目录一行就推荐。
   证据卡片只渲染本地仓库数据。

4. **预算是成本保险丝，不是可检索性上限。** 软预算 6 轮：停下汇报已有证据，
   UI 提供「继续深入」。硬上限 10 轮防失控。另计工具结果 token 预算。
   **预算耗尽与未找到是两个终止状态**，前者不得显示「收藏库中未找到」。

5. **能力分级。** `test` 探针在连通性之外检测工具调用规范性与长上下文定位。
   不合格模型降级到 ADR 0042 的固定召回流程（`selectAskCandidates` + 单次生成）。
   旧探针记录缺省为固定流程，直到用户重新测试。

6. **consent v3。** 出网范围从「至多 12 条候选」变为「全库元数据 + 按需笔记」。
   v1 / v2 同意不得静默升级，必须重新披露并确认。笔记仍受「包含笔记」偏好约束。

7. **Ask 不再等待 embedding。** 编排层删除语义近邻通道。空库（零仓库）仍不调用上游。

## Consequences

- 防幻觉结构从「索引 ∈ 本次召回集」改为「id ∈ 本轮已展开集合」；跨轮、跨工具调用仍成立。
- `ask-generate` 必须重新部署：放行 `tool` 角色、放大消息上限、透传 `tools`、转换 `tool_calls`。
- 弱模型走固定流程，避免 BYOK 下 agent 循环在不支持工具的模型上崩坏。
- 若未来增加联网搜索、MCP、或把循环搬到服务端，必须新开 ADR。
