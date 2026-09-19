# 2026-09-19 · Ask Asterism BYOK 决策与实现前置准备

## 决策

维护者裁定 GitHub #41 的生成策略：**BYOK LLM 生成 + 检索严格限于个人库 + 不做抽取式兜底**。
决策记录于 **ADR 0042**（`../decisions/0042-ask-byok-grounded-generation.md`），要点：

- OpenAI 兼容 LLM，v1 固定 Provider 枚举（DeepSeek / OpenAI / Groq / OpenRouter），无自定义 base URL。
- key 仅存浏览器 localStorage（按用户隔离、版本化键，沿 embedding consent 先例）；服务端零存储。
- 新增无状态 Edge Function `ask-generate`：JWT 校验 + Provider 白名单 + 透传 `Authorization` + 单次 JSON 转发；无存储、无 credential 日志（白名单同时消除 SSRF 面，浏览器直连被上游 CORS 阻止）。
- Ask 是唯一允许 Memory 原文出浏览器的路径，须显式同意；embedding 链路边界不变。
- 防幻觉由结构保证：本地 top-K 召回 → prompt 只含候选结构化数据 → 模型输出 JSON（summary + 推荐索引）→ 客户端校验索引 ∈ 召回集 → 卡片由本地数据渲染；召回为空不调用 LLM，直接返回未找到。
- 未配置 key → 配置引导；失败 / 超时 → 可重试双语错误。v1 单次 JSON 请求，不做流式。

## 本轮完成

- **ADR 0042** 立项并 Accepted。
- **contracts 修订**：
  - `product.md`：Scope 新增「Ask 生成（ADR 0042）」条目；Advanced Features 新增「Ask Asterism 私有问答」条目；Non-Goals 两处收窄（AI Chat → 无边界聊天；服务端 AI 整理禁令明确不涵盖客户端 BYOK 形态）。
  - `architecture.md`：Edge Functions 清单（图 + 蓝图）补 `ask-generate`；Data Flow 新增 Ask 生成数据流段落；ADR 0032 注记补 ADR 0042 划界。
  - `data-model.md`：设计原则注明 Ask BYOK 零服务端表、key 与同意存 localStorage。
- **GitHub #41**：验收标准追加 BYOK / 代理 / 校验 / 无兜底四项（见 issue Amendment 节），并留决策评论。
- **BACKLOG / PROGRESS**：frontier 条目与恢复点更新。

## 实现执行计划（blockers-first，单 issue 内分五步）

依赖链：① core 领域逻辑 → ② Edge Function → ③ web 配置与同意 → ④ Ask 面板 → ⑤ 门禁与验收。①③ 无相互依赖可并行起步，④ 消费全部前三者。

### ① core · Ask 领域逻辑（纯函数，无网络）

- 位置：`packages/core/src/repos/` 新增 `ask.ts`（+ `ask.test.ts`）。
- 输入输出复用 `retrieveRepos` 的 `RetrieveResult` / `MatchExplanation`：
  - `buildAskPrompt(question, candidates, opts)`：把 top-K 候选（名称、描述、语言、topics、`whySaved` / `note` 原文、Match Explanation）组装为 system + user prompt；要求 JSON 输出 `{ summary, recommendations: number[] }`（索引指向候选数组）。
  - `parseAskResponse(raw, candidates)`：宽容解析（JSON mode 或裸 JSON 提取），校验推荐索引 ∈ `[0, K)`，去重、丢弃越界索引；解析失败给可区分错误。
  - `askNoResultAnswer()`：固定「未找到」语义（文案在 UI 层 i18n，core 只给判定）。
- 单测：prompt 组装含记忆原文与解释、索引校验（越界 / 重复 / 空）、解析失败路径、追问上下文拼接。

### ② Edge Function · `ask-generate`

- 位置：`supabase/functions/ask-generate/`（Deno，对齐 `read-repo-readme` 的 JWT 校验风格）。
- 行为：校验 Supabase JWT → `provider` 枚举映射固定 base URL（deepseek / openai / groq / openrouter）→ 透传客户端 `Authorization`（Provider key）与受控 body（model、messages、temperature、`response_format`）→ 转发 `chat/completions` → 回传 JSON。
- 硬边界：无日志输出 body / key；无持久化；非白名单 provider 一律 400；上游 4xx/5xx/超时原样映射为可区分错误码。
- 本地无 Docker：函数逻辑用独立单测（可抽纯逻辑）+ 部署后 smoke（runbook 模式）。

### ③ web · BYOK 配置与同意

- 位置：`apps/web/src/lib/ask-byok.ts`（+ 测试，仿 `embedding-consent.ts`：localStorage 键 `asterism:ask-byok:v1:{userId}`，值 `{ provider, model, key, consentedAt }`，try/catch 降级会话内）；`use-ask-byok.ts` hook。
- Settings 页新增「Ask Asterism」分区：Provider 下拉（枚举）、model 文本（带默认值：`deepseek-chat` 等）、key 密码框（仅本地保存说明）；保存前展示出网同意对话框（明示 `whySaved` / `note` / 仓库元数据将发送给所选 Provider），双语。
- i18n：`apps/web/src/i18n/locales/` en + zh-CN 同步加键。

### ④ web · Ask 面板

- Command Palette 式全局弹层：顶栏入口 + 快捷键（拟 `Ctrl/Cmd+K`，与现有 `J` / `K` 面板内导航不冲突，输入框聚焦时不劫持既有快捷键）。
- 状态机：未配置 key（配置引导，可跳 Settings）→ 召回中 → 生成中（平滑 loading）→ 回答（`summary` + 本地渲染推荐卡片：名称、描述、证据标签「来自你的 Memory 笔记 / 仓库描述」、Match Explanation 复用 #39 组件，点击开 Repo Quick Look `sourceKey: 'ask'`）→ 未找到（固定双语文案）→ 错误（可重试）。
- 追问：面板保留会话问答历史，每轮重新本地召回后拼接上下文。
- 客户端请求：`use-ask-question.ts` 走 `packages/db` 的函数调用封装，60s 超时中断。
- 键盘（Esc 关闭、Tab 导航、聚焦管理）与移动端自适应；i18n 全量。
- dev-only 预览路由 `/dev/ask-preview`（fixture 覆盖各状态分支，供视觉 QA，不进生产包）。

### ⑤ 门禁与验收

- `pnpm lint / typecheck / test / build` 四道门禁；核心单测 + web 交互测试（配置流、同意流、状态机、校验渲染）。
- runbook `knowledge/runbooks/self-host.md` 补 `ask-generate` 部署行与说明（无新增 secret）；README 部署清单联动。
- 维护者远端项目部署函数 + 真实 smoke（问题 → 引用可点 → Quick Look 打开）后，按 #41 验收标准逐项勾选关闭。

## 边界

- 本轮未修改任何生产代码、未部署远端、未创建子 issue（#41 单 issue 纵向切片，沿用 #39 / #40 交付模式）。
- 未提交 git；knowledge 变更待维护者确认后以 `docs(knowledge)` 提交。

## 下一步

fresh context 按 ①→⑤ 顺序实现 #41；实现完成后更新 PROGRESS / BACKLOG 并落交付日志，远端部署按 runbook 显式执行。
