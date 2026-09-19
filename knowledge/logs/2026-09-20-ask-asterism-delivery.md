# 2026-09-20 · Ask Asterism 本地实现交付（GitHub #41）

## Outcome

按 ADR 0042 与准备日志的五步计划完成 **Ask Asterism 私有问答（GitHub #41）的本地实现**：
BYOK 生成、个人库召回、引用校验、Settings 配置与同意流、Command Palette 式面板、
双语 i18n、交互测试与 dev 预览路由全部落地；四道工程门禁（lint / typecheck / test / build）
与 impeccable 视觉检查（桌面明暗 + 移动亮色 + 设计检测器）通过。
**未做**：远端 `ask-generate` 部署与真实账号 smoke（按 runbook 由维护者显式执行）、
production 验收与 issue 关闭。

## 交付明细

### ① core · `packages/core/src/repos/ask.ts`（+16 单测）

- **Provider 白名单**：`ASK_PROVIDERS`（DeepSeek / OpenAI / Groq / OpenRouter），固定 base URL、
  默认模型、JSON mode 支持位与 i18n labelKey。
- **召回 `selectAskCandidates`**：自然语言问题分词（拉丁词含 c++/c# 写法 + 中文 bigram，
  停用词只收黏着虚词），多字段词法评分（whySaved 5 / note 4 / name 4 / language 3 / topic 3 /
  description 2，个人 Memory 权重最高，对齐统一检索优先级），门槛 ≥2；未命中词法的语义近邻
  （embedding 未授权时自然缺席）按距离追加；排序完全确定（分 → star → fullName → repoId）。
  候选携带**证据理由**（MatchReason + 摘录，复用 extractSnippet），供界面渲染证据标签。
- **Prompt `buildAskPrompt`**：候选以带索引结构化文本给出（元数据 + Memory 原文），system
  限定只引用候选索引、无匹配时如实说明、严格 JSON（summary + recommendations 索引）；
  追问历史仅作语境不携带旧候选；回答语言跟随 `document.documentElement.lang`。
- **校验 `parseAskResponse`**：容忍围栏与前后杂讯；summary 必须非空；推荐索引逐个校验
  ∈ 候选集（丢弃越界 / 非整数 / 重复），硬上限 5，映射回 repoId 后才允许进入界面。

### ② Edge Function · `supabase/functions/ask-generate/`（8 单测）

- 无状态代理：JWT 校验 → Provider 白名单映射固定 URL → 透传客户端 providerKey 与受控 body
  （model / messages / temperature / response_format）→ 单次 JSON 转发 → 回传 content。
- 输入收敛（消息 ≤40 条、单条 ≤32k 字符、总量 ≤200k、model 白名单字符集、key 长度区间），
  超标一律 400 不做静默修剪；上游 401/403 → `invalid_provider_key`，4xx/429 →
  `provider_rejected`，网络 → `retryable_error`(502)，60s AbortSignal → 504；
  不存储、不日志化 credential 或请求体。handler/入口分离 + 独立单测（沿 read-repo-readme 模式）。

### ③ 数据与配置层

- `packages/db/src/ask.ts`：`invokeAskGenerate`（functions.invoke 封装，504 → timeout，
  传输/信封异常折叠 retryable；5 单测）。
- `apps/web/src/lib/ask-byok.ts`：`asterism:ask-byok:v1:{userId}` 版本化 localStorage，
  值含 `consentedAt` + `consentedProvider`（换 Provider 视为未同意需重新披露）；解析失败 /
  未知 Provider / 同意不一致一律判 null；useSyncExternalStore 订阅（5 单测）。
- Settings 新分区 `settings-ask-section.tsx`：Provider Select + Model Input + Key 密码框
  （仅本地保存说明），保存走出网披露 Dialog（明示 whySaved / note / 仓库元数据将发送给所选
  Provider）；同 Provider 改模型静默保存，换 Provider 重新披露；Remove 走 ConfirmDialog
  （4 单测覆盖同意 / 静默 / 重披露 / 移除）。

### ④ Ask 面板（apps/web/src/components/ask/）

- 顶栏「Ask」按钮（含 ⌘K / Ctrl K 快捷键提示与 aria-keyshortcuts）+ 全局快捷键唤出
  Command Palette 式 Dialog（自管焦点：autoFocus 进输入框）。
- `use-ask-question.ts` 状态机：recalling（等待仓库数据与可选语义检索）→ generating →
  answered / not_found / error（retryable / timeout / invalid_key / provider_rejected / unparsable）；
  **召回为空不调用 LLM**（结构性防幻觉）；每轮追问重新召回；settledId 防重复执行。
- 回答渲染：summary + 推荐卡片（本地数据渲染：语言色点、owner/name、描述两行截断、
  MatchExplanationBadge 证据标签 + star 数），点击开 Repo Quick Look（sourceKey `ask`，
  上下文为本轮全部候选，J/K 可在候选内移动）；未配置 key → 配置引导直达 Settings；
  invalid_key → 设置入口；其余错误 → 可重试。Esc / Tab 由 Dialog 基元保证。
- dev-only 预览 `/dev/ask-preview`（fixture 覆盖 answered / recalling / generating / not_found /
  双错误态 / 追问历史，双语切换；不进生产包）。
- i18n：`ask.*` + `settings.ask*` en / zh-CN 全量外部化。

### 质量门禁与视觉检查

- `pnpm lint / typecheck / test / build` 全绿；新增测试 38 个（core 16、function 8、db 5、
  web 面板 6 + 配置 4 + 存储 5），全仓 300+ 测试通过。
- impeccable：Extend existing surface 路径（继承 Graphite Glass，无方向轮盘）；批式截图
  （桌面 1280 亮/暗 + 移动 390 亮）一轮修复（预览 answered 分区空渲染、invalid_key 补设置
  入口）后复核通过；`detect.mjs` 检测器零发现。视觉审查以线程内替代方式完成
  （本 harness 无 shipped finish-reviewer agent，如实披露）。

## 边界与遗留

- 无数据库 migration、无服务端 secret；`ask-generate` 远端部署按 runbook 显式执行
  （`supabase functions deploy ask-generate`，维护者 project ref），不随代码提交自动生效。
- #41 验收标准中「真实环境回答 / 引用可点 / Quick Look 打开」的 production smoke 与
  issue 关闭留给维护者部署后执行（对齐 #40 的验收模式）。
- 不做流式（ADR 0042 v1 单次 JSON）；后续如需流式 / 多 Provider 管理需新 ADR。

## 下一步

1. ~~维护者远端部署 `ask-generate`~~（已于同日由维护者指令下执行，见下）。
2. 真实账号 smoke（配置 key → 提问 → 引用直达 Quick Look → 无匹配返回未找到）后关闭 #41。

## 远端部署记录（2026-09-20 追加）

- `supabase functions deploy ask-generate` 于维护者指令下执行，部署至
  `hqtrmulypxwdqvzlkhke`（CLI 2.109.1，Dashboard 可查）。
- 传输层 smoke 通过：OPTIONS 预检 200；无 JWT / 伪造 JWT 均被平台 `verify_jwt`
  层拦截（401，UNAUTHORIZED_*），说明鉴权前置生效；handler 自身的会话校验
  （`admin.auth.getUser`）将在带真实会话的请求中执行。
- 带真实 Supabase 会话 + 真实 Provider key 的端到端回答链路需维护者登录态与
  个人 key，属 #41 验收步骤，未自动化。
