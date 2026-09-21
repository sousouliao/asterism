# Product Contract · 产品契约

> 本文件定义 Asterism 的产品范围与验收标准（Definition of Done）。它是产品层 verification gate 的依据：一个功能"算不算做完"，以这里的验收清单为准，而非主观判断。

## Vision · 愿景

Asterism 是一个**开源、多端、可自部署的个人开源软件记忆库**：**your private memory for open-source software**。它从用户自己的 GitHub Stars 出发，保留 GitHub 没有的个人上下文，并让用户在真正需要时重新找到、理解和使用曾关注的软件。

**可自部署（self-deployable）**指用户可使用自己控制的 Supabase Cloud 项目与静态托管环境完成完整部署；**完全自托管（fully self-hosted）**指自行运行完整 Supabase 基础设施。Phase 1 只承诺前者，不维护项目自有 Docker Compose。

名字 "Asterism"（星群）仍表达把零散关注连成有意义记忆的品牌隐喻。

“星图 / 星座”是产品品牌与知识组织的比喻，不承诺以二维点云地图作为用户界面。正式交互必须直接服务于查找、判断或整理仓库。

## Target Users · 目标用户

- **重度 Star 用户**：曾关注数百或上千个开源项目，却难以回忆当时为什么保存、后来是否仍相关。
- **开发者与技术研究者**：希望从过去关注的软件中找回适合当前问题的工具、判断与个人上下文。
- **跨设备 / 跨端用户**：希望在浏览器、扩展、桌面之间共享同一份组织好的收藏。
- **注重数据自主**：偏好开源、可自托管、数据可导出的方案。

## Scope · 范围

- **阶段顺序**：已交付响应式 Web、可靠批量整理、Memory Foundation、统一 Retrieval 与 Resurface；下一 frontier 为 Ask Asterism 私有问答。浏览器扩展与桌面端保留，但延后到 Memory / Retrieval 稳定以后。
- **数据源**：用户自己的 GitHub starred 仓库是首个 Memory 来源（通过 GitHub GraphQL API 拉取）；近期不接入外部互联网发现或其他 Provider。
- **后端**：Supabase（Auth + Postgres source-of-truth + Edge Functions），TanStack Query 提供会话内请求缓存。当前不承诺离线浏览；多个客户端会话不主动推送收敛，进入页面、查询刷新、完成本地操作或重新连接后读取最新状态。
- **语义能力**：隐形混合搜索与 Related Stars 使用浏览器内 embedding；被嵌文本由仓库元数据与用户自己的 `whySaved` / `note` 组成，原文只在浏览器内处理，派生向量按用户存于 RLS 隔离的 `user_repo_embeddings`。它不依赖 BYOK，也不修改集合或 Memory canonical。
- **AI 整理退役**：产品不再提供服务端 Generation、BYOK Connection、AI 整理草稿或 Organization Task。历史 AI 执行已经形成的普通组织关系继续作为 canonical 用户数据保留。
- **Ask 生成（ADR 0042 / 0044 / 0045）**：Ask Asterism 的回答生成使用用户自带 key 的 OpenAI 兼容 LLM（BYOK，v1 固定 Provider 枚举：DeepSeek / OpenAI / Groq / OpenRouter）；key 仅存浏览器本地，经无状态 Edge Function `ask-generate` 透传，服务端不保存 credential。主干是目录常驻浅层 Agent：每轮把个人库目录作为稳定前缀，再由浏览器内确定性工具 `filter` / `search` / `expand` 按需取证；Ask 不再依赖 embedding。检索与证据严格限于个人库，不联网搜索。出网范围是全库元数据（名称、语言、topics、描述）加按需笔记，由同意对话如实披露；既有同意向前迁移，不因范围变化要求重签（ADR 0046）。「包含笔记」偏好只控制 `expand` 是否送出 `whySaved` / `note`。回答以流式 Markdown 正文呈现，推荐 `repoId` 必须属于本轮已 `expand` 的集合，由本地数据渲染为证据卡片。工具轮次软预算耗尽时汇报已有证据并提供「继续深入」，不得显示「未找到」。Agent 是唯一路径，不按模型能力分流：不调工具的模型照样得到目录与正文，只是没有推荐卡片（ADR 0046）。未配置 key 时提供配置引导，不提供无 LLM 的兜底回答。Settings 提供还原的连接管理体验（ADR 0043）：具名连接的新建 / 编辑 / 启停 / 删除、模型检测（失败可手填模型 ID）、连通性探针与活跃连接偏好。
- **Memory 模型（ADR 0037）**：每个用户与 Repo 首版恰好一条 Memory，承载来源、来源时间、`whySaved` 与自由文本 `note`。Star 是初始来源，不是产品终点；系统不得猜测 `whySaved`。
- **组织模型（ADR 0035）**：用户自定义组织关系只保留 Collection。Collection 是次级人工组织能力，保留既有功能但暂停新增 Collection Management；GitHub Language / Topics / Archived / 时间承担客观筛选。

### Language · 领域用语

- **Collection**：用户命名的 starred 仓库分组，允许多归属，可进入、可筛选、可批量维护。「待读」「生产可用」等状态型短标记也是 Collection。
- **GitHub metadata**：仓库的客观属性（语言、topics、归档、时间、star 数），不是用户组织概念。
- **Memory**：用户与 Repo 的私有关系记录。首版每个用户与仓库一条，保存来源、来源时间、收藏原因与自由文本笔记。
- **Why saved**：用户本人记录的收藏原因；缺失时必须明确显示未记录，不得由 AI 推断。
- **Note**：Memory 中的自由文本字段。独立 Note 模型已由 #37 cutover 直接退役。
- 避免对用户说 Tag / Label / 分类 来表示第二套组织关系。

各阶段交付节奏见 `../roadmap.md`。

---

## MVP Features · 核心功能与验收标准

以下为 MVP（对应 Phase 1 Web）必须交付的能力。每项以 checklist 形式给出 Definition of Done，**全部勾选方可视为完成**。

**Phase 1 收尾（Phase 1 closure）**：指下列验收项全部兑现，而不只是用户可见主流程已经可用。任何未勾选项都是进入 Phase 2 前必须关闭的 **Phase 1 阻断项**；不得仅通过缩减既有契约把它延期到后续阶段。

除功能 checklist 外，Phase 1 还必须在干净检出中通过 `lint / typecheck / test / build` 四道跨平台工程门禁。

Phase 1 必须提供可执行的 self-deployment runbook，覆盖 migrations、GitHub OAuth、`sync-stars` / `read-repo-readme` Edge Functions、环境变量和 Web 静态部署；完整 Supabase Docker 自托管不属于本阶段。

### 1. GitHub OAuth 登录

- [x] 用户可通过 Supabase GitHub provider 一键登录 / 登出。
- [x] 登录仅请求读取公开数据所需的最小 scope（公开 star 列表无需额外 scope）。
- [x] 会话持久化，刷新页面 / 重开应用后保持登录态。
- [x] 登录失败 / 取消授权有明确的错误反馈。

### 2. 同步 starred（增量）

- [x] 首次登录后可全量拉取用户的 starred 仓库。
- [x] 支持**增量同步**：再次同步时仅拉取自上次同步后新增 / 变更的项，不重复全量。
- [x] 同步过程有可见进度反馈（进行中 / 完成 / 失败）。
- [x] 同步结果写入 Postgres（source-of-truth），客户端通过 `packages/db` 查询最新状态。
- [x] 同步失败可重试，不产生重复或脏数据。

### 3. 响应式浏览（卡片 / 列表 + 虚拟滚动）

- [x] 提供**卡片视图**与**列表视图**两种布局，可切换。
- [x] 列表 / 卡片使用**虚拟滚动**（TanStack Virtual），上千条仓库滚动流畅、内存稳定。
- [x] 布局响应式适配桌面 / 平板 / 移动宽度。
- [x] 每个仓库项展示关键信息：名称、描述、语言、star 数、最近更新时间、归档状态。

### 4. 多维筛选

- [x] 可按**编程语言**筛选。
- [x] 可按 **topic** 筛选。
- [x] 可按 **star 数**范围筛选。
- [x] 可按**更新时间**（pushed_at）筛选。
- [x] 可按**是否归档**筛选。
- [x] 多个筛选条件可组合生效，并能一键清除。

### 5. 关键词搜索

- [x] 可按关键词搜索仓库名称 / 描述（MVP 为本地关键词匹配，非语义）。
- [x] 搜索与筛选可叠加生效。
- [x] 搜索为即时反馈（输入即更新结果）。

关键词搜索是当前已交付能力。ADR 0026（Accepted）确立的检索优先范式把 Browse 搜索演进为**隐形混合搜索**——关键词命中与语义近邻融合为一套排序、**零模式开关**（不新增 Semantic 模式切换），由浏览器内 embedding 支撑、弱设备降级纯关键词；在其落地前，Browse 维持上述关键词搜索。

### 6. 标签（Tags）— ADR 0035 接受退役

Phase 1 已交付自定义标签，下列验收保持为历史完成记录。ADR 0035 已落地：用户命名的组织关系只保留 Collection。不再提供创建、筛选或展示 Tag，`/tags` 重定向到 `/collections`。Tag color 不迁移；ADR 0038 后不再接受含旧 Tag 模型的 v1/v2 JSON。

- [x] 用户可创建 / 重命名 / 删除自定义标签。
- [x] 可给单个仓库添加 / 移除多个标签。
- [x] 可按标签筛选仓库。
- [x] 标签数据按 `user_id` 隔离，互不可见。

### 7. 集合（Collections）

- [x] 用户可创建 / 重命名 / 删除集合。
- [x] 可将仓库加入 / 移出集合，一个仓库可属于多个集合。
- [x] 可浏览单个集合内的仓库。
- [x] 集合数据按 `user_id` 隔离。

Cutover 后集合还需承担原标签的 Browse 筛选与卡片整理上下文，并在约 100 个集合时保持可搜索；这些是 ADR 0035 实现验收，不是 Phase 1 阻断项。

### 8. 笔记（Notes，Memory Foundation 前的历史实现）

- [x] 用户可为单个仓库撰写 / 编辑 / 删除笔记。
- [x] 笔记持久化到 Postgres，并在后续查询时从 source-of-truth 读取最新状态。
- [x] 笔记数据按 `user_id` 隔离。

### 9. 统计洞察（用户面名称：Insights / 洞察）

- [x] 可查看语言、topic、star 时间等维度的可视化统计。
- [x] 统计只基于当前用户经 RLS 可见的数据。

### 10. 导入 / 导出

- [x] JSON 支持完整备份与恢复。
- [x] CSV 可导出仓库清单，Markdown 可按集合与个人 Memory 形成可读归档。
- [x] CSV / Markdown 明确为只导出格式，不承诺恢复。

### 11. 写失败恢复（Write Failure Recovery）

- [x] 创建、重命名与删除集合（cutover 前含标签）失败时，操作目标与表单输入保持可见，提供双语错误反馈并允许原位重试或取消。
- [x] Memory 保存失败时保留 `whySaved`、`note` 草稿与 Inspector 上下文，不关闭面板，并提供双语错误反馈与重试路径。
- [x] 集合关联失败时恢复服务器状态并明确通告失败；不得让界面暗示未持久化的关系已经成功。cutover 前标签关联遵守同一规则。
- [x] 写操作 pending 期间阻止重复提交与误关闭。Phase 1 不采用 optimistic mutation，不要求通用 rollback 框架。

---

## Advanced Features · 进阶功能（后续阶段）

以下能力不属于 MVP，按路线图分阶段交付，验收标准在对应阶段细化。

> **ADR 0032 退役 AI 整理**：Asterism 保留手动批量整理与浏览器内语义检索，不再提供 BYOK Generation、AI 草稿、Organization Task 或同步后整理机会。历史执行结果继续作为普通 canonical 数据保留。
- **Memory Foundation（GitHub #37，本地实现完成、远端验收待办）**：以每个 `user × repo` 一条 Memory 替代独立 Note，承载 `whySaved` 与 `note`；Stars 同步幂等创建基础记录，Quick Look 提供完整编辑与失败恢复，导入导出使用 JSON v3 Memory 格式。ADR 0038 明确不迁移旧 Note，也不兼容 v1/v2 JSON。
- **统一 Retrieval（GitHub #39，已交付）**：`@asterism/core` 统一处理仓库元数据与 Memory 的词法召回、个人意图优先排序、语义扩展与可验证的 Match Explanation；Browse 与 Related Stars 共用浏览器内 embedding，弱设备或运行时失败时保持关键词检索与可信的本地 Related Stars 降级。
- **Resurface 沉睡唤醒（GitHub #40，已交付）**：主页以纯本地、确定性的双流唤醒沉睡 Star——「值得重温」（沉睡且有个人记忆信号或整年纪念日）与「待补全记忆」（高价值且未记录 `why_saved`）；每条候选只携带可验证的结构化理由（收藏时长、纪念日、笔记存在性、push 时间、star 数），不推断访问行为。Useful / Dismiss 反馈为 90 天本地压制，不写 canonical、不做遥测。规格见 ADR 0041。
- **Ask Asterism 私有问答（GitHub #41，已授权）**：常驻页面底部的直接输入区；全局快捷键（⌘K / Ctrl K）聚焦 composer，而不是唤起弹层。主干是目录常驻浅层 Agent（ADR 0045）：个人库目录作为稳定前缀，浏览器内 `filter` / `search` / `expand` 穷举取证，推荐 `repoId` 必须属于本轮已展开集合；Ask 不再依赖 embedding。回答由用户 BYOK 的 OpenAI 兼容 LLM 流式生成（ADR 0042 / 0044）；正文为受约束的 Markdown，证据卡片只渲染本地数据，点击直达 Repo Quick Look。空库不调用 LLM，明确告知未找到；预算耗尽与未找到必须区分，前者提供「继续深入」。支持快捷追问（目录前缀稳定，历史轮次随对话保留）与停止生成；不存在按模型能力分流的第二条流程（ADR 0046）。双语、键盘友好与移动端自适应。未配置 key 时引导配置，无抽取式兜底。
- **退役用户自定义 Tag（ADR 0035）**：cutover 已把每个 Tag 转为或合并进同名 Collection，删除 Tag 用户面与表。Browse 增加集合筛选；Quick Look 与批量只留 Collection + Memory；Collections 索引 / 选择器可搜索并支撑约 100 个集合；新导出只写 Collection。ADR 0038 之后导入仅接受 v3，不再保留 v1 Tag 转换入口。Tag color 不迁移。实现规格见 `logs/2026-08-19-retire-user-tags.md`，落地记录见 `logs/2026-08-19-retire-user-tags-cutover.md`。
- **失效仓库检测**：识别已删除 / 已归档 / 长期无更新的仓库并提示。
- **批量整理**（Phase 2）：多选仓库后批量加入/移出集合、导出选中仓库；只修改 Asterism 私有数据，不执行 GitHub star/unstar，也不申请 `public_repo` scope。ADR 0035 cutover 前确认层仍可同时配置标签与集合；cutover 后只配置集合。用户执行“全选当前筛选结果”时，系统立即把当时匹配的仓库固化为一个**选择范围快照**（repository ID 集合）；后续筛选变化或同步新增仓库不得悄然改变该批工作的对象，界面持续显示准确数量，用户可清空后重新选择。批量关系写入以一条“仓库 × 集合 × 添加或移除动作”为最小执行与重试单位（cutover 前历史账本仍可能含标签关系）：成功项保留，失败项单独报告且只重试失败关系；重复添加已有关系或移除不存在的关系视为成功，确保重试幂等。执行前尚未确认的勾选只属于当前会话；用户确认后必须形成持久化的**批量操作记录**，保存稳定的选择范围、动作和逐关系结果，使页面刷新、关闭或网络中断后仍可继续查看并重试。失败关系分为**可重试失败**（网络、超时或临时服务故障）与**终止失败**（目标已删除、权限/归属不成立或请求无效）；终止失败不得原样反复重试。批量操作只有在全部关系成功，或剩余终止失败被用户明确结束后，才进入完成状态。选中仓库导出复用现有格式：JSON v3 是包含所选仓库及其 Collection、Memory 的可恢复部分备份，导入时只合并对应数据而不删除库中其他内容；CSV 是所选仓库清单，Markdown 是包含个人上下文的可读归档，二者仍不承诺恢复。导出按固定 repository ID 范围读取下载时的最新 Postgres 权威数据；导出不写数据，因此不建立批量操作记录，失败后原位重新生成。
- **退役集合盘（Collection Dial，ADR 0036）**：Browse 不再提供拖拽 Grip、底部半圆盘或 Dial Undo。加入或移出集合只走 Quick Look 与批量整理对话框。已经由 Dial 写入的 `collection_repos` 作为 canonical 数据保留；受信 `collection_relation_heads` 与 collection mutation RPC 继续服务 Quick Look / 导入 / 批量执行。若未来重新提出 Browse 直接整理，必须新开 ADR，不得复活本次删除的状态机或 `collection_dial` interaction。
- **保存视图 / 查询历史**（Phase 2 之后按需评估）：Phase 2 的批量整理只作用于当前手动选择或当前筛选结果，不持久化命名筛选，也不保存关键词或语义查询历史。
- **语义搜索 / 相关收藏**：ADR 0026（Accepted）确立**检索优先范式**；ADR 0027 基于真实 518 条个人 Star 验证，用保守的局部语义邻域取代全库涌现簇；ADR 0028 进一步移除没有独占用户任务的二维语义星图。浏览器内 embedding（默认 `multilingual-e5-small`，非 BYOK）支撑隐形混合搜索和 Repo Quick Look 中最多 5 条互为 Top-12 近邻的相关收藏；无可信结果时不展示。向量按用户存于 `user_repo_embeddings`（derived 数据，永不写 canonical）。

## Extension-Specific · 浏览器扩展专属能力

浏览器扩展不是当前 frontier；以下能力延后到 Memory / Retrieval 基础稳定后重新验收。

- **GitHub 仓库页内加入集合 / 写笔记**：通过 content script，在 GitHub 仓库页面内直接把当前仓库加入集合或写笔记，无需切回应用。不提供用户自定义 Tag。
- **Popup 快搜**：点击扩展图标弹出快速搜索面板，秒搜已收藏仓库。
- **右键收藏**：通过右键菜单将当前仓库快速加入集合。

---

## Non-Goals · 明确不做

- **不做 GitHub 客户端**：不替代 GitHub 浏览代码、issue、PR 等功能，只围绕用户曾关注的开源软件建立私人 Memory 与 Retrieval。
- **近期不做远期 Memory 推演能力**：Memory Foundation 不实现 AI Chat、联网搜索、RepoSnapshot、Research Session、MCP、动态 Constellation、Taste Graph、Idea Collision 或二维星图 UI。ADR 0042 的 Ask 是严格限定个人库、带证据链的 grounded 问答，不属于无边界 AI Chat。
- **不管理他人的 star**：只管理登录用户自己的 starred 仓库，不做社交 / 公共分享星单（至少 MVP 与近期路线图内不做）。
- **不做通用书签管理器**：范围限定在 GitHub 仓库，不扩展到任意 URL 收藏。
- **不提供服务端 AI 整理**：服务端不保存 Provider credential，不调用 Generation Provider，不生成或执行 AI 整理计划。ADR 0042 的 Ask BYOK 生成由客户端持有 key、经无状态代理完成，不属于本条禁止的服务端设施。
- **不提供第二套用户组织概念**：ADR 0035 之后不为状态型短标记重新发明 Tag / Label；排他状态若出现真实需求，必须新立项，不能复活 Tag。
- **不做实时协作 / 团队工作区**：MVP 与近期路线图聚焦个人使用，不做多人协作。
- **不采集匿名产品遥测**：当前不加入自建或第三方产品行为采集。未来若出现明确分析需求，必须重新定义采集范围、关闭机制、自部署行为与隐私说明。
