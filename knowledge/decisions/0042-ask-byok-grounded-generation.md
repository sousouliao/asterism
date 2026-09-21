# ADR 0042 · Ask Asterism 生成策略：客户端 BYOK、无状态代理与引用校验

- Status: Accepted
- Date: 2026-09-19
- Amended by: ADR 0044（流式 Markdown 回答；修订本决策第 7 条）
- Implements: GitHub #41 `feat(ask): private and grounded repository Q&A (Ask Asterism)`（实现前决策）
- Amends: ADR 0037 的 near-term non-goals 中「不恢复服务端 BYOK Generation」表述（本决策为客户端形态，服务端禁令继续成立）
- Preserves: ADR 0037 私有定位、ADR 0032 不复活服务端 Provider 架构、ADR 0039 consent v2 与「解释只陈述可验证事实」、ADR 0041 本地可解释纪律

## Context

GitHub #41 要求自然语言意图问答：用户问「我存过哪些支持 WebSocket 且性能好的 Rust 库？」，
期望得到综合对比式回答与可追溯证据链。纯抽取式回答（从检索命中字段模板拼装）无法做跨仓库
综合、取舍与推荐论述，读起来不像「建议」。

维护者于 2026-09-19 决策：**Ask 采用 BYOK LLM 生成，检索严格限于个人库，不联网搜索，
并且不做抽取式兜底**。该决策与三条既有约束交叉，需在本 ADR 中显式处理：

1. ADR 0037 non-goals 写明「不恢复服务端 BYOK Generation / AI 整理」。
2. ADR 0032 规定重提 AI 能力「必须以新的产品证据和 ADR 重新立项，不能直接复活被删除的
   Provider、Task 或 Plan 架构」。
3. 产品与架构契约承诺被嵌「原文只在浏览器内处理」（语义能力数据流边界）。

技术事实：DeepSeek、OpenAI 等 OpenAI 兼容 API 不返回浏览器 CORS 头，客户端无法直连，
任何浏览器内生成都需要服务端转发一次。

## Decision

1. **生成器为用户自带 key 的 OpenAI 兼容 LLM**。v1 只提供固定 provider 枚举
   （DeepSeek / OpenAI / Groq / OpenRouter），每个枚举映射到函数内固定的 base URL，
   不接受任意自定义 base URL——provider 白名单从根上消除代理的 SSRF 面。
2. **key 只存浏览器**：按用户隔离的版本化 localStorage 键（沿 embedding consent
   `asterism:*:v{N}:{userId}` 命名先例），服务端零存储、零加密设施、零轮换函数。
   不复活 ADR 0032 删除的任何服务端凭证架构。
3. **传输经无状态 Edge Function `ask-generate`**：校验 Supabase JWT → 按 provider 枚举
   解析固定上游 URL → 透传客户端随请求携带的 `Authorization` → 转发单次 JSON 请求并回传
   响应。函数不存储、不日志化任何 credential 或请求体；无会话状态。
4. **Ask 是唯一允许 Memory 原文出浏览器的路径，且必须显式同意**：首次配置或首次提问时
   呈现同意界面，明示 `whySaved` / `note` 原文与仓库元数据将发送给用户选择的 Provider；
   同意状态沿 consent v2 模式存 localStorage。embedding 链路「原文不出浏览器」的承诺不变。
5. **防幻觉由结构保证，不靠提示词自觉**：
   - 检索完全在本地：统一检索引擎（#39）产出 top-K 候选与 Match Explanation；
   - prompt 只包含候选的结构化数据与问题，要求输出 JSON（`summary` + 推荐候选索引列表）；
   - 客户端校验每个推荐索引 ∈ 召回集合，推荐卡片与引用标签由**本地数据**渲染——
     模型在结构上无法把库外仓库带进界面；
   - 召回为空时不调用 LLM，直接返回固定的双语「你的收藏库中未找到匹配方案」。
6. **不做抽取式兜底**：未配置 key 时 Ask 面板呈现配置引导而非降级回答；调用失败 / 超时
   给出可重试的双语错误。Ask 以 BYOK 为前提，接受「自部署实例未配 key 时 Ask 不可用」
   的权衡（其余功能不受影响）。
7. **v1 为单次 JSON 请求，不做流式**：完整 JSON 才能做引用校验；loading 期间提供平滑的
   进行中反馈（满足 issue 的「loading/streaming 反馈」取前者）。流式输出留待真实需求
   另行立项。

## Consequences

- 服务端不新增表、不新增 secret；部署面只增加一个 Edge Function 的部署行（runbook 在
  实现阶段同步补充）。数据模型零变更。
- 「原文只在浏览器内处理」收窄为「除用户显式同意的 Ask 生成路径外」，已在产品与架构
  契约同步修订。
- 幻觉风险收敛到 `summary` 文本本身；推荐列表与证据链在结构上不可能引用库外仓库。
- localStorage 保存 API key 接受 XSS 暴露面，与 embedding consent 同一信任边界；不承诺
  服务端代管。文档需向用户明示该存储位置。
- 「不做 AI Chat」收窄为「不做无边界聊天」：Ask 是严格 ground 在个人库、带证据链的问答，
  多轮追问仍每轮基于本地检索重新召回。
- 若未来需要多 Provider 管理界面、服务端凭证存储、流式输出或非白名单自定义端点，
  必须新开 ADR，不得在实现中悄悄扩张。
